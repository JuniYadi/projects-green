import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockToastSuccess = mock()
const mockToastError = mock()

mock.module("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

// Mock ui/dialog so it renders in-place for happy-dom unit tests
mock.module("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-slot="dialog">{children}</div> : null,
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-slot="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <div data-slot="dialog-header" className={className}>
      {children}
    </div>
  ),
  DialogTitle: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <h2 data-slot="dialog-title" className={className}>
      {children}
    </h2>
  ),
  DialogDescription: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => (
    <p data-slot="dialog-description" className={className}>
      {children}
    </p>
  ),
  DialogClose: ({
    children,
    asChild,
  }: {
    children: React.ReactNode
    asChild?: boolean
  }) => <>{children}</>,
}))

const mockGetCatalogProduct = mock()
const mockSubmitCheckout = mock()
const mockGetCheckoutQuote = mock()

mock.module("@/lib/billing-client", () => ({
  getCatalogProduct: mockGetCatalogProduct,
}))

mock.module("@/app/[lang]/console/billing/checkout/checkout-client", () => ({
  getCheckoutQuote: mockGetCheckoutQuote,
  submitCheckout: mockSubmitCheckout,
}))

import { ServiceOrderDialog } from "./service-order-dialog"

describe("ServiceOrderDialog", () => {
  beforeEach(() => {
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockSubmitCheckout.mockClear()
    mockGetCatalogProduct.mockClear()
    mockGetCheckoutQuote.mockClear()

    mockGetCheckoutQuote.mockResolvedValue({
      ok: true,
      quoteId: "quote-1",
      quoteToken: "token-1",
      pricingId: "pricing-wa-starter-mo",
      packageCode: "WHATSAPP",
      planCode: "WA_STARTER",
      currency: "IDR",
      billingPeriod: "MONTHLY",
      quantity: "1",
      periodStart: "2026-08-01T00:00:00Z",
      periodEnd: "2026-09-01T00:00:00Z",
      subtotal: "99000",
      discount: "0",
      firstPayment: "99000",
      nextRenewal: "2026-09-01T00:00:00Z",
      addons: [],
      availableAddons: [],
      resources: {
        provisioningFields: [
          {
            id: "field-phone",
            name: "phoneNumber",
            label: "Nomor WhatsApp Device",
            type: "text",
            placeholder: "Contoh: +6281234567890",
            required: true,
          },
          {
            id: "field-name",
            name: "displayName",
            label: "Nama Tampilan Device (Opsional)",
            type: "text",
            required: false,
          },
        ],
      },
      expiresAt: "2026-08-24T00:00:00Z",
    })

    mockGetCatalogProduct.mockResolvedValue({
      product: {
        id: "prod-wa",
        code: "WHATSAPP",
        name: "WhatsApp Platform",
        description: "WhatsApp Business messaging",
        isActive: true,
        plans: [
          {
            id: "plan-wa-starter",
            code: "WA_STARTER",
            name: "Starter Plan",
            description: "Untuk UMKM",
            resources: { devices: 1 },
            offers: [
              {
                id: "pricing-wa-starter-mo",
                pricingId: "pricing-wa-starter-mo",
                billingPeriod: "MONTHLY",
                periodPrice: "99000",
                currency: "IDR",
                chargeUnit: "SUBSCRIPTION",
              },
            ],
          },
        ],
      },
      currency: "IDR",
    })
  })

  it("loads catalog and renders plan options on open", async () => {
    const handleOpenChange = mock()

    const view = render(
      <ServiceOrderDialog
        productCode="WHATSAPP"
        open={true}
        onOpenChange={handleOpenChange}
      />
    )

    await waitFor(() => {
      expect(view.getByText("Starter Plan")).toBeTruthy()
      expect(view.getByText("WHATSAPP")).toBeTruthy()
    })
  })

  it("keeps activation button disabled until phone number and balance agreement are filled", async () => {
    const view = render(
      <ServiceOrderDialog
        productCode="WHATSAPP"
        open={true}
        onOpenChange={() => {}}
      />
    )

    // Quote (and its product-defined fields) resolves after the catalog,
    // so wait for a field rather than only for plan cards.
    await waitFor(() => {
      expect(view.getByTestId("order-input-phoneNumber")).toBeTruthy()
    })

    const initialBtn = view.getByTestId("order-submit-button")
    expect((initialBtn as HTMLButtonElement).disabled).toBe(true)

    const phoneInput = view.getByTestId(
      "order-input-phoneNumber"
    ) as HTMLInputElement
    await userEvent.type(phoneInput, "+6281234567890")

    const checkbox = view.getByTestId(
      "order-confirm-balance-checkbox"
    ) as HTMLInputElement
    await userEvent.click(checkbox)

    await waitFor(() => {
      expect(
        (view.getByTestId("order-submit-button") as HTMLButtonElement).disabled
      ).toBe(false)
    })
  })

  it("submits checkout and renders success confirmation with toast and receipt details", async () => {
    mockSubmitCheckout.mockResolvedValue({
      ok: true,
      orderId: "order-wa-888",
      status: "CHARGED",
      subscriptionId: "sub-wa-123",
      invoiceId: "inv-123",
      invoiceLineId: "line-123",
      subtotal: "99000",
      discount: "0",
      firstPayment: "99000",
      nextRenewal: "2026-09-01T00:00:00Z",
      currency: "IDR",
      billingPeriod: "MONTHLY",
      periodStart: "2026-08-01T00:00:00Z",
      periodEnd: "2026-09-01T00:00:00Z",
    })

    const handleSuccess = mock()

    const view = render(
      <ServiceOrderDialog
        productCode="WHATSAPP"
        open={true}
        onOpenChange={() => {}}
        onSuccess={handleSuccess}
        lang="id"
      />
    )

    // Wait for the quote so product-defined fields are on screen.
    await waitFor(() => {
      expect(view.getByTestId("order-input-phoneNumber")).toBeTruthy()
    })

    const phoneInput = view.getByTestId(
      "order-input-phoneNumber"
    ) as HTMLInputElement
    await userEvent.type(phoneInput, "+6281234567890")

    const checkbox = view.getByTestId(
      "order-confirm-balance-checkbox"
    ) as HTMLInputElement
    await userEvent.click(checkbox)

    const activateBtn = view.getByTestId("order-submit-button")
    await waitFor(() => {
      expect((activateBtn as HTMLButtonElement).disabled).toBe(false)
    })
    fireEvent.click(activateBtn)

    await waitFor(() => {
      expect(mockSubmitCheckout).toHaveBeenCalled()
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Aktivasi layanan berhasil!",
        expect.objectContaining({
          description: expect.stringContaining("order-wa-888"),
        })
      )
      expect(view.getByText("Aktivasi Instan Sukses!")).toBeTruthy()
      expect(
        view.queryByText("ID Pesanan: order-wa-888") ||
          view.queryByText("Order ID: order-wa-888")
      ).toBeTruthy()
      expect(view.getByText("Lihat Invoice")).toBeTruthy()
      expect(view.getByText("inv-123")).toBeTruthy()
      expect(handleSuccess).toHaveBeenCalled()
    })
  })

  it("renders no provisioning form when product defines no form fields", async () => {
    mockGetCheckoutQuote.mockResolvedValue({
      ok: true,
      quoteId: "quote-2",
      quoteToken: "token-2",
      pricingId: "pricing-wa-starter-mo",
      packageCode: "WHATSAPP",
      planCode: "WA_STARTER",
      currency: "IDR",
      billingPeriod: "MONTHLY",
      quantity: "1",
      periodStart: "2026-08-01T00:00:00Z",
      periodEnd: "2026-09-01T00:00:00Z",
      subtotal: "99000",
      discount: "0",
      firstPayment: "99000",
      nextRenewal: "2026-09-01T00:00:00Z",
      addons: [],
      availableAddons: [],
      resources: {},
      expiresAt: "2026-08-24T00:00:00Z",
    })

    const view = render(
      <ServiceOrderDialog
        productCode="WHATSAPP"
        open={true}
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(view.getByText("Starter Plan")).toBeTruthy()
    })

    expect(view.queryByText("Konfigurasi Layanan")).toBeNull()
    expect(view.queryByTestId("order-input-phoneNumber")).toBeNull()

    // Activation is gated only by the balance agreement when the product
    // defines no required fields.
    const checkbox = view.getByTestId(
      "order-confirm-balance-checkbox"
    ) as HTMLInputElement
    await userEvent.click(checkbox)

    await waitFor(() => {
      expect(
        (view.getByTestId("order-submit-button") as HTMLButtonElement).disabled
      ).toBe(false)
    })
  })

  it("renders select-type options from the product form definition", async () => {
    mockGetCheckoutQuote.mockResolvedValue({
      ok: true,
      quoteId: "quote-3",
      quoteToken: "token-3",
      pricingId: "pricing-wa-starter-mo",
      packageCode: "WHATSAPP",
      planCode: "WA_STARTER",
      currency: "IDR",
      billingPeriod: "MONTHLY",
      quantity: "1",
      periodStart: "2026-08-01T00:00:00Z",
      periodEnd: "2026-09-01T00:00:00Z",
      subtotal: "99000",
      discount: "0",
      firstPayment: "99000",
      nextRenewal: "2026-09-01T00:00:00Z",
      addons: [],
      availableAddons: [],
      resources: {
        provisioningFields: [
          {
            id: "field-tier",
            name: "supportTier",
            label: "Tier Support",
            type: "select",
            required: true,
            options: ["Basic", "Priority"],
          },
        ],
      },
      expiresAt: "2026-08-24T00:00:00Z",
    })

    const view = render(
      <ServiceOrderDialog
        productCode="WHATSAPP"
        open={true}
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(view.getByText("Tier Support")).toBeTruthy()
    })

    expect(view.getByTestId("order-input-supportTier")).toBeTruthy()

    const checkbox = view.getByTestId(
      "order-confirm-balance-checkbox"
    ) as HTMLInputElement
    await userEvent.click(checkbox)

    // Required select blocks activation until an option is chosen.
    expect(
      (view.getByTestId("order-submit-button") as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it("submits product-defined answers as provisioningAnswers with device mapping", async () => {
    mockSubmitCheckout.mockResolvedValue({
      ok: true,
      orderId: "order-wa-889",
      status: "CHARGED",
      subscriptionId: "sub-wa-124",
      invoiceId: "inv-124",
      subtotal: "99000",
      discount: "0",
      firstPayment: "99000",
      nextRenewal: "2026-09-01T00:00:00Z",
      currency: "IDR",
      billingPeriod: "MONTHLY",
      periodStart: "2026-08-01T00:00:00Z",
      periodEnd: "2026-09-01T00:00:00Z",
    })

    const view = render(
      <ServiceOrderDialog
        productCode="WHATSAPP"
        open={true}
        onOpenChange={() => {}}
      />
    )

    await waitFor(() => {
      expect(view.getByTestId("order-input-phoneNumber")).toBeTruthy()
    })

    const phoneInput = view.getByTestId(
      "order-input-phoneNumber"
    ) as HTMLInputElement
    await userEvent.type(phoneInput, "+6281234567890")

    const nameInput = view.getByTestId(
      "order-input-displayName"
    ) as HTMLInputElement
    await userEvent.type(nameInput, "Support Line")

    const checkbox = view.getByTestId(
      "order-confirm-balance-checkbox"
    ) as HTMLInputElement
    await userEvent.click(checkbox)

    const activateBtn = view.getByTestId("order-submit-button")
    await waitFor(() => {
      expect((activateBtn as HTMLButtonElement).disabled).toBe(false)
    })

    fireEvent.click(activateBtn)

    await waitFor(() => {
      expect(mockSubmitCheckout).toHaveBeenCalled()
      const payload = mockSubmitCheckout.mock.calls[0][0]
      expect(payload.device).toEqual({
        phoneNumber: "+6281234567890",
        displayName: "Support Line",
        profilePictureUrl: undefined,
      })
      expect(payload.metadata.provisioningAnswers).toEqual({
        phoneNumber: "+6281234567890",
        displayName: "Support Line",
      })
      expect(payload.metadata.provisioningFieldsSchema).toEqual([
        { name: "phoneNumber", label: "Nomor WhatsApp Device", type: "text" },
        {
          name: "displayName",
          label: "Nama Tampilan Device (Opsional)",
          type: "text",
        },
      ])
    })
  })
})
