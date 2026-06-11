import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

import InvoiceDetailPage from "./page"

const originalFetch = globalThis.fetch

mock.module("next/navigation", () => ({
  useParams: () => ({ id: "inv-1", lang: "en" }),
  useSearchParams: () => new URLSearchParams(),
}))

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })

const invoicePayload = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  invoice: {
    id: "inv-1",
    invoiceNumber: "INV-2026-001",
    status: "OPEN",
    type: "TOP_UP",
    paymentMethod: "MANUAL_BANK",
    issuedAt: "2026-05-01T00:00:00.000Z",
    dueAt: "2026-05-15T00:00:00.000Z",
    totalAmountIdr: "299000.00",
    currency: "IDR",
    lines: [],
    ...overrides,
  },
})

describe("Billing InvoiceDetailPage", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === "/api/billing/invoices/inv-1") {
        return jsonResponse(invoicePayload())
      }

      if (url === "/api/billing/account") {
        return jsonResponse({
          ok: true,
          tenantId: "tenant-1",
          currency: "IDR",
          balanceIdr: "0.00",
          formattedBalance: "Rp0",
          isAboveWarn: false,
          isPositive: false,
          accountAge: "1 day",
        })
      }

      if (url === "/api/payments/bank-accounts") {
        return jsonResponse({
          ok: true,
          accounts: [
            {
              id: "bank-1",
              bankCode: "BCA",
              bankName: "Bank Central Asia",
              accountName: "PFNApp Technologies Inc.",
              accountNumber: "1234567890",
              isActive: true,
              isDefault: true,
            },
          ],
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("shows working PDF download action", async () => {
    const view = render(<InvoiceDetailPage />)

    await waitFor(() =>
      expect(view.getByRole("button", { name: /download pdf/i })).toBeEnabled()
    )
  })

  it("shows manual bank transfer instructions with bank details", async () => {
    const view = render(<InvoiceDetailPage />)

    await waitFor(() =>
      expect(view.getByText("Bank Central Asia")).toBeInTheDocument()
    )

    expect(view.getByText("1234567890")).toBeInTheDocument()
    expect(view.getByText("PFNApp Technologies Inc.")).toBeInTheDocument()
    expect(view.getByRole("link", { name: /confirm payment/i })).toBeInTheDocument()
  })

  it("shows a continue payment gateway action when gateway URL exists", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url === "/api/billing/invoices/inv-1") {
        return jsonResponse(
          invoicePayload({
            paymentMethod: "PAYMENT_GATEWAY",
            paymentUrl: "https://pay.example.test/inv-1",
          })
        )
      }

      if (url === "/api/billing/account") {
        return jsonResponse({
          ok: true,
          tenantId: "tenant-1",
          currency: "IDR",
          balanceIdr: "0.00",
          formattedBalance: "Rp0",
          isAboveWarn: false,
          isPositive: false,
          accountAge: "1 day",
        })
      }

      if (url === "/api/payments/bank-accounts") {
        return jsonResponse({ ok: true, accounts: [] })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() =>
      expect(
        view.getByRole("link", { name: /continue to payment gateway/i })
      ).toHaveAttribute("href", "https://pay.example.test/inv-1")
    )
  })
})
