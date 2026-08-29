import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
const mockQrToDataURL = mock(async () => "data:image/png;base64,mockqr")
mock.module("qrcode", () => ({
  default: {
    toDataURL: mockQrToDataURL,
  },
}))

const mockTopupMethodsGet = mock(async () => ({
  data: {
    ok: true,
    currency: "IDR",
    config: {
      symbol: "Rp",
      ratePerBase: 18000,
      baseCode: "IDR",
      presets: [50000, 100000, 250000, 500000],
      minTopup: 25000,
      maxTopup: 50000000,
    },
  },
}))

const mockTopupPost = mock(async () => ({
  data: {
    ok: true,
    invoice: {
      id: "inv_topup_123",
      invoiceNumber: "INV-TOPUP-123",
      amount: 50000,
      status: "OPEN",
    },
    paymentUrl: "https://mock.gateway/pay",
    vaNumber: "98877665544",
  },
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      payments: {
        topup: {
          methods: {
            get: mockTopupMethodsGet,
          },
          post: mockTopupPost,
        },
      },
    },
  },
}))

const mockGetInvoice = mock(async (id: string) => ({
  ok: true,
  invoice: {
    id,
    invoiceNumber: "INV-TOPUP-123",
    status: "OPEN",
    totalAmountIdr: "50000",
    currency: "IDR",
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
  },
}))

mock.module("@/lib/billing-client", () => ({
  getInvoice: mockGetInvoice,
  formatBillingMoney: (amt: number | string, curr: string) => `${curr} ${amt}`,
}))

import { QuickTopUpDialog } from "./quick-top-up-dialog"

describe("QuickTopUpDialog", () => {
  beforeEach(() => {
    mockTopupMethodsGet.mockClear()
    mockTopupPost.mockClear()
    mockGetInvoice.mockClear()
    mockQrToDataURL.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders preset amounts and creates topup invoice upon submission", async () => {
    const handleOpenChange = mock(() => {})
    const handleSuccess = mock(() => {})

    const view = render(
      <QuickTopUpDialog
        open={true}
        onOpenChange={handleOpenChange}
        currentBalance="Rp 10.000"
        suggestedAmount={150000}
        currency="IDR"
        onSuccess={handleSuccess}
      />
    )

    expect(view.getByText("Express Top Up")).toBeDefined()
    expect(view.getByText("Exact Shortage")).toBeDefined()
    expect(view.getAllByText(/\+Rp\s*150\.000/).length).toBeGreaterThanOrEqual(
      1
    )
    const payButton = view.getByRole("button", {
      name: /Pay Rp\s*150\.000 Instantly/i,
    })
    fireEvent.click(payButton)

    await waitFor(() => {
      expect(mockTopupPost).toHaveBeenCalledTimes(1)
    })

    expect((mockTopupPost.mock.calls as unknown[][])[0]![0]).toEqual({
      amount: 150000,
      paymentMethod: "QRIS",
    })

    await waitFor(() => {
      expect(view.getByText("INV-TOPUP-123")).toBeDefined()
    })
  })

  it("allows switching to VA method and displays VA number", async () => {
    const view = render(
      <QuickTopUpDialog open={true} onOpenChange={() => {}} currency="IDR" />
    )

    const vaButton = view.getByText("Virtual Account")
    fireEvent.click(vaButton)

    const payButton = view.getByRole("button", {
      name: /Pay Rp\s*50\.000 Instantly/i,
    })
    fireEvent.click(payButton)
    await waitFor(() => {
      expect(mockTopupPost).toHaveBeenCalledWith({
        amount: 50000,
        paymentMethod: "VA",
      })
    })

    await waitFor(() => {
      expect(view.getByText("98877665544")).toBeDefined()
    })
  })

  it("polls and succeeds when invoice status turns paid", async () => {
    mockGetInvoice.mockResolvedValueOnce({
      ok: true,
      invoice: {
        id: "inv_topup_123",
        invoiceNumber: "INV-TOPUP-123",
        status: "PAID",
        totalAmountIdr: "50000",
        currency: "IDR",
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
      },
    })

    const handleSuccess = mock(() => {})
    const view = render(
      <QuickTopUpDialog
        open={true}
        onOpenChange={() => {}}
        onSuccess={handleSuccess}
      />
    )

    const payButton = view.getByRole("button", {
      name: /Pay Rp\s*50\.000 Instantly/i,
    })
    fireEvent.click(payButton)
    await waitFor(() => {
      expect(view.getByText("I have already paid / Check Status")).toBeDefined()
    })

    const checkStatusBtn = view.getByText("I have already paid / Check Status")
    fireEvent.click(checkStatusBtn)

    await waitFor(() => {
      expect(view.getByText("Payment Received!")).toBeDefined()
      expect(handleSuccess).toHaveBeenCalledTimes(1)
    })
  })
})
