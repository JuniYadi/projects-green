import "@/test/register"
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, fireEvent, waitFor } from "@testing-library/react"
import { ServiceOrderDialog } from "./service-order-dialog"

const mockGetCatalogProduct = mock()
const mockGetCheckoutQuote = mock()
const mockSubmitCheckout = mock()

mock.module("@/lib/billing-client", () => ({
  getCatalogProduct: mockGetCatalogProduct,
}))

mock.module("@/app/[lang]/console/billing/checkout/checkout-client", () => ({
  getCheckoutQuote: mockGetCheckoutQuote,
  submitCheckout: mockSubmitCheckout,
}))

describe("ServiceOrderDialog", () => {
  beforeEach(() => {
    mockGetCatalogProduct.mockClear()
    mockGetCheckoutQuote.mockClear()
    mockSubmitCheckout.mockClear()

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
        provisioningFields: [],
      },
      expiresAt: "2026-08-24T00:00:00Z",
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
      expect(mockGetCatalogProduct).toHaveBeenCalledWith("WHATSAPP", "IDR")
      expect(view.getByText("Starter Plan")).toBeTruthy()
      expect(view.getByText("WHATSAPP")).toBeTruthy()
    })
  })

  it("keeps activation button disabled until balance agreement is checked", async () => {
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

    const activateBtn = view.getByText("Aktifkan Layanan Sekarang")
    expect((activateBtn as HTMLButtonElement).disabled).toBe(true)

    // Check balance agreement checkbox
    const checkbox = view.getByLabelText(
      /Saya menyetujui pemotongan saldo/i
    ) as HTMLInputElement
    fireEvent.click(checkbox)

    await waitFor(() => {
      expect(
        (view.getByText("Aktifkan Layanan Sekarang") as HTMLButtonElement)
          .disabled
      ).toBe(false)
    })
  })

  it("submits checkout and renders success confirmation", async () => {
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

    const checkbox = view.getByLabelText(
      /Saya menyetujui pemotongan saldo/i
    ) as HTMLInputElement
    fireEvent.click(checkbox)

    const activateBtn = view.getByText("Aktifkan Layanan Sekarang")
    await waitFor(() => {
      expect((activateBtn as HTMLButtonElement).disabled).toBe(false)
    })

    fireEvent.click(activateBtn)

    await waitFor(() => {
      expect(mockSubmitCheckout).toHaveBeenCalled()
      expect(view.getByText("Aktivasi Instan Sukses")).toBeTruthy()
      expect(view.getByText("Order ID: order-wa-888")).toBeTruthy()
      expect(handleSuccess).toHaveBeenCalled()
    })
  })
})
