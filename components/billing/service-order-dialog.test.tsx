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
      resources: {},
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

    await waitFor(() => {
      expect(view.getByText("Starter Plan")).toBeTruthy()
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
      />
    )

    await waitFor(() => {
      expect(view.getByText("Starter Plan")).toBeTruthy()
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
      expect(view.getByText("Order ID: order-wa-888")).toBeTruthy()
      expect(view.getByText("Lihat Invoice")).toBeTruthy()
      expect(view.getByText("inv-123")).toBeTruthy()
      expect(handleSuccess).toHaveBeenCalled()
    })
  })
})
