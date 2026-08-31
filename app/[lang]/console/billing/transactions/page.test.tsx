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

describe("TransactionsPage with Statement & Invoices tabs", () => {
  beforeEach(() => {
    mockHistoryGet.mockReset()
    mockStatementGet.mockReset()
  })

  it("renders both statements and invoices tabs", async () => {
    mockStatementGet.mockResolvedValueOnce({
      data: {
        ok: true,
        statements: [
          {
            id: "adj-1",
            type: "CREDIT",
            amount: "50000.00",
            currency: "IDR",
            reason: "Top up successful",
            source: "TOPUP",
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
            createdAt: new Date("2026-05-02").toISOString(),
            invoice: null,
          },
        ],
      },
    })

    mockHistoryGet.mockResolvedValueOnce({
      data: {
        ok: true,
        data: [
          {
            id: "inv-1",
            invoiceNumber: "TOP-001",
            status: "PAID",
            type: "TOP_UP",
            paymentMethod: "QRIS",
            totalAmount: 50000,
            currency: "IDR",
            createdAt: new Date("2026-05-01").toISOString(),
            dueDate: null,
            metadata: null,
          },
        ],
      },
    })

    const view = render(<TransactionsPage />)

    await waitFor(() => {
      expect(
        view.getAllByText("Balance Statement (Debit/Credit)").length
      ).toBeGreaterThanOrEqual(1)
      expect(
        view.getAllByText("Invoices & Top-Up History").length
      ).toBeGreaterThanOrEqual(1)
    })

    expect(view.getByText("Top up successful")).toBeInTheDocument()
    expect(view.getByText("App Hosting usage charge")).toBeInTheDocument()
    expect(view.getByText("Credit (+)")).toBeInTheDocument()
    expect(view.getByText("Debit (−)")).toBeInTheDocument()
  })
})
