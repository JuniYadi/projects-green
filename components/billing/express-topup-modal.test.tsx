import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import { render, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

import { ExpressTopupModal } from "./express-topup-modal"

const mockQrToDataURL = mock(async () => "data:image/png;base64,mockqr")
mock.module("qrcode", () => ({
  default: { toDataURL: mockQrToDataURL },
  toDataURL: mockQrToDataURL,
}))

const mockTopupPost = mock(async () => ({
  data: {
    ok: true,
    invoice: {
      id: "inv-123",
      invoiceNumber: "TOP-ABC",
    },
    paymentUrl: "https://sandbox.duitku.com/pay/123",
    vaNumber: "888800012345",
  },
}))

const mockTopupMethodsGet = mock(async () => ({
  data: {
    ok: true,
    currency: "IDR",
    config: {
      symbol: "Rp",
      ratePerBase: 18000,
      baseCode: "USD",
      presets: [50000, 100000, 250000, 500000],
      minTopup: 25000,
      maxTopup: 50000000,
    },
    methods: {
      QRIS: true,
      VA: true,
    },
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

const mockGetInvoice = mock(async () => ({
  ok: true,
  invoice: {
    id: "inv-123",
    invoiceNumber: "TOP-ABC",
    status: "PAID",
  },
}))

mock.module("@/lib/billing-client", () => ({
  getInvoice: mockGetInvoice,
}))

describe("ExpressTopupModal", () => {
  beforeEach(() => {
    mockTopupPost.mockClear()
    mockTopupMethodsGet.mockClear()
    mockGetInvoice.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders modal with initial state, presets, and quick payment methods", async () => {
    const handleOpenChange = mock(() => {})
    const view = render(
      <ExpressTopupModal
        open={true}
        onOpenChange={handleOpenChange}
        currentBalance="Rp 10.000"
        currency="IDR"
      />
    )

    expect(view.getByText("Express Top Up")).toBeInTheDocument()
    expect(view.getByText(/Rp 10\.000/)).toBeInTheDocument()
    expect(view.getByText("QRIS Instant")).toBeInTheDocument()
    expect(view.getByText("Virtual Account")).toBeInTheDocument()
  })

  it("allows selecting preset amount and submitting for QRIS payment", async () => {
    const user = userEvent.setup()
    const view = render(
      <ExpressTopupModal open={true} onOpenChange={() => {}} currency="IDR" />
    )

    await waitFor(() => {
      expect(mockTopupMethodsGet).toHaveBeenCalled()
    })

    const payButton = view.getByRole("button", {
      name: /Pay .* Instantly/i,
    })
    expect(payButton).toBeInTheDocument()

    await user.click(payButton)

    await waitFor(() => {
      expect(mockTopupPost).toHaveBeenCalled()
      expect(view.getByText("Total Payment:")).toBeInTheDocument()
      expect(view.getByText("TOP-ABC")).toBeInTheDocument()
    })
  })

  it("switches to Virtual Account method and displays VA number upon creation", async () => {
    const user = userEvent.setup()
    const view = render(
      <ExpressTopupModal open={true} onOpenChange={() => {}} currency="IDR" />
    )

    await waitFor(() => {
      expect(mockTopupMethodsGet).toHaveBeenCalled()
    })

    const vaButton = view.getByRole("button", { name: /Virtual Account/i })
    await user.click(vaButton)

    const payButton = view.getByRole("button", {
      name: /Pay .* Instantly/i,
    })
    await user.click(payButton)

    await waitFor(() => {
      expect(view.getByText("888800012345")).toBeInTheDocument()
    })
  })

  it("allows manual check status to complete top-up", async () => {
    const user = userEvent.setup()
    const handleSuccess = mock(() => {})
    const view = render(
      <ExpressTopupModal
        open={true}
        onOpenChange={() => {}}
        currency="IDR"
        onSuccess={handleSuccess}
      />
    )

    const payButton = view.getByRole("button", {
      name: /Pay .* Instantly/i,
    })
    await user.click(payButton)

    await waitFor(() => {
      expect(view.getByText("Total Payment:")).toBeInTheDocument()
    })

    const checkButton = view.getByRole("button", {
      name: /I have already paid \/ Check Status/i,
    })
    await user.click(checkButton)

    await waitFor(() => {
      expect(mockGetInvoice).toHaveBeenCalledWith("inv-123")
      expect(view.getByText("Payment Received!")).toBeInTheDocument()
      expect(handleSuccess).toHaveBeenCalled()
    })
  })
})
