import { beforeEach, afterEach, describe, expect, it, mock } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"

type ConfirmationResponse = { id: string; status: string }
const mockConfirmationsGet = mock(
  async (): Promise<{ data: ConfirmationResponse[] }> => ({ data: [] })
)

mock.module("next/navigation", () => ({
  useRouter: () => ({ push: mock() }),
  useSearchParams: () => new URLSearchParams(),
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      portal: {
        payments: {
          confirmations: { get: mockConfirmationsGet },
        },
      },
    },
  },
}))

mock.module(
  "@/app/[lang]/portal/billing/payments/overview/overview-tab",
  () => ({ OverviewTab: () => null })
)
mock.module(
  "@/app/[lang]/portal/billing/payments/gateways/gateways-tab",
  () => ({ GatewaysTab: () => null })
)
mock.module(
  "@/app/[lang]/portal/billing/payments/bank-accounts/bank-accounts-tab",
  () => ({ BankAccountsTab: () => null })
)
mock.module(
  "@/app/[lang]/portal/billing/payments/currencies/currencies-tab",
  () => ({ CurrenciesTab: () => null })
)
mock.module(
  "@/app/[lang]/portal/billing/payments/confirmations/confirmations-tab",
  () => ({ ConfirmationsTab: () => null })
)

const { PaymentTabs } = await import("./payment-tabs")

describe("PaymentTabs", () => {
  beforeEach(() => {
    mockConfirmationsGet.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    cleanup()
  })

  it("counts only pending confirmations in the badge", async () => {
    mockConfirmationsGet.mockResolvedValueOnce({
      data: [
        { id: "pending-1", status: "PENDING" },
        { id: "approved-1", status: "APPROVED" },
        { id: "pending-2", status: "PENDING" },
        { id: "rejected-1", status: "REJECTED" },
      ],
    })

    const view = render(<PaymentTabs defaultTab="confirmations" />)

    await waitFor(() => {
      expect(mockConfirmationsGet).toHaveBeenCalled()
    })

    expect(view.getByText("2")).toBeInTheDocument()
    expect(view.queryByText("4")).not.toBeInTheDocument()
  })

  it("does not render a badge when there are no pending confirmations", async () => {
    mockConfirmationsGet.mockResolvedValueOnce({
      data: [
        { id: "approved-1", status: "APPROVED" },
        { id: "rejected-1", status: "REJECTED" },
      ],
    })

    const view = render(<PaymentTabs defaultTab="confirmations" />)

    await waitFor(() => {
      expect(mockConfirmationsGet).toHaveBeenCalled()
    })

    expect(view.queryByText("0")).not.toBeInTheDocument()
  })
})
