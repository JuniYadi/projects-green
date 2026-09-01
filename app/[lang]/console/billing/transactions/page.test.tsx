import { describe, it, expect, beforeEach, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import TransactionsPage from "@/app/[lang]/console/billing/transactions/page"

const mockHistoryGet = mock()
const mockStatementGet = mock()

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      payments: {
        history: {
          get: mockHistoryGet,
        },
      },
      billing: {
        account: {
          statement: {
            get: mockStatementGet,
          },
        },
      },
    },
  },
}))

describe("TransactionsPage with Balance Statement view", () => {
  beforeEach(() => {
    mockHistoryGet.mockReset()
    mockStatementGet.mockReset()
  })

  it("renders balance statement with summary cards and ending balance", async () => {
    mockStatementGet.mockResolvedValueOnce({
      data: {
        ok: true,
        account: {
          id: "acc-1",
          organizationId: "org-1",
          currency: "IDR",
          balanceIdr: "35000.00",
          formattedBalance: "Rp 35.000",
        },
        statements: [
          {
            id: "adj-1",
            type: "CREDIT",
            amount: "50000.00",
            currency: "IDR",
            reason: "Top up successful",
            source: "TOPUP",
            balanceBefore: "0.00",
            balanceAfter: "50000.00",
            createdAt: new Date("2026-05-01").toISOString(),
            invoice: {
              id: "inv-1",
              invoiceNumber: "TOP-001",
              status: "PAID",
            },
          },
          {
            id: "adj-2",
            type: "DEBIT",
            amount: "15000.00",
            currency: "IDR",
            reason: "App Hosting usage charge",
            source: "APP_HOSTING",
            balanceBefore: "50000.00",
            balanceAfter: "35000.00",
            createdAt: new Date("2026-05-02").toISOString(),
            invoice: null,
          },
        ],
      },
    })
    const view = render(<TransactionsPage />)

    await waitFor(() => {
      expect(
        view.getAllByText("Balance Statement (Debit/Credit)").length
      ).toBeGreaterThanOrEqual(1)
    })

    expect(view.getByText("Top up successful")).toBeInTheDocument()
    expect(view.getByText("App Hosting usage charge")).toBeInTheDocument()
    expect(view.getByText("Credit (+)")).toBeInTheDocument()
    expect(view.getByText("Debit (−)")).toBeInTheDocument()
    expect(view.getByText("Current Balance")).toBeInTheDocument()
    expect(view.getByText("Total Top-Up / Inflow")).toBeInTheDocument()
    expect(view.getByText("Total Usage / Outflow")).toBeInTheDocument()
    expect(view.getByText("Rp 35.000")).toBeInTheDocument()
    expect(view.getByText("Ending Balance")).toBeInTheDocument()
    expect(view.getByText("View All Invoices")).toBeInTheDocument()
  })
})
