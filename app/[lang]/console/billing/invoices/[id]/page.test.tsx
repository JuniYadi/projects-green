import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { useParams } from "next/navigation"
import { fireEvent, render, waitFor } from "@testing-library/react"

import InvoiceDetailPage from "./page"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })

const accountPayload = (currency: string) => ({
  ok: true,
  tenantId: "tenant-1",
  currency,
  balanceIdr: "0.00",
  formattedBalance: `${currency} 0.00`,
  isAboveWarn: false,
  isPositive: false,
  accountAge: "1 day",
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
    periodStart: "2026-05-01T00:00:00.000Z",
    periodEnd: "2026-05-31T23:59:59.000Z",
    subtotalAmountIdr: "299000.00",
    taxAmountIdr: "0.00",
    discountAmountIdr: "0.00",
    totalAmountIdr: "299000.00",
    currency: "IDR",
    lines: [
      {
        description: "Top-up balance",
        quantity: "1.00",
        amountIdr: "299000.00",
        unitPriceIdr: "299000.00",
        currency: "IDR",
      },
    ],
    ...overrides,
  },
})

describe("Billing InvoiceDetailPage", () => {
  beforeEach(() => {
    ;(useParams as ReturnType<typeof mock>).mockReturnValue({ id: "inv-1" })
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(invoicePayload())
      }

      if (url.includes("/api/billing/account")) {
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

      if (url.includes("/api/payments/bank-accounts")) {
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
    expect(
      view.getByRole("link", { name: /confirm payment/i })
    ).toBeInTheDocument()
  })

  it("shows a continue payment gateway action when gateway URL exists", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            paymentMethod: "PAYMENT_GATEWAY",
            paymentUrl: "https://pay.example.test/inv-1",
          })
        )
      }

      if (url.includes("/api/billing/account")) {
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

      if (url.includes("/api/payments/bank-accounts")) {
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

  it("renders USD totals, line amount, and visible Tax/Discount rows", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            currency: "USD",
            subtotalAmountIdr: "100.00",
            taxAmountIdr: "10.00",
            discountAmountIdr: "5.00",
            totalAmountIdr: "105.00",
            lines: [
              {
                description: "Service",
                quantity: "1.00",
                amountIdr: "100.00",
                unitPriceIdr: "100.00",
                currency: "USD",
              },
            ],
          })
        )
      }

      if (url.includes("/api/billing/account")) {
        return jsonResponse(accountPayload("USD"))
      }

      if (url.includes("/api/payments/bank-accounts")) {
        return jsonResponse({ ok: true, accounts: [] })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() => {
      expect(view.getByText("Subtotal")).toBeInTheDocument()
      expect(view.getByText("Tax")).toBeInTheDocument()
      expect(view.getByText("Discount")).toBeInTheDocument()
      expect(view.getByText("Total")).toBeInTheDocument()
      expect(view.getAllByText("$100.00").length).toBeGreaterThan(0)
      expect(view.getAllByText("$10.00").length).toBeGreaterThan(0)
      expect(view.getAllByText("$5.00").length).toBeGreaterThan(0)
      expect(view.getAllByText("$105.00").length).toBeGreaterThan(0)
      expect(view.getByText("Amount")).toBeInTheDocument()
    })
  })

  it("renders IDR totals with non-breaking-space locale formatting", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            currency: "IDR",
            subtotalAmountIdr: "100000.00",
            taxAmountIdr: "11000.00",
            discountAmountIdr: "0.00",
            totalAmountIdr: "111000.00",
            lines: [
              {
                description: "Service",
                quantity: "1.00",
                amountIdr: "100000.00",
                unitPriceIdr: "100000.00",
                currency: "IDR",
              },
            ],
          })
        )
      }

      if (url.includes("/api/billing/account")) {
        return jsonResponse(accountPayload("IDR"))
      }

      if (url.includes("/api/payments/bank-accounts")) {
        return jsonResponse({ ok: true, accounts: [] })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() => {
      expect(view.getAllByText(/IDR\s*100,000\.00/).length).toBeGreaterThan(0)
      expect(view.getAllByText(/IDR\s*11,000\.00/).length).toBeGreaterThan(0)
      expect(view.getAllByText(/IDR\s*0\.00/).length).toBeGreaterThan(0)
      expect(view.getAllByText(/IDR\s*111,000\.00/).length).toBeGreaterThan(0)
    })
  })

  it("falls back to account currency when invoice currency is empty", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            currency: "",
            totalAmountIdr: "105.00",
            subtotalAmountIdr: "105.00",
            taxAmountIdr: "0.00",
            discountAmountIdr: "0.00",
            lines: [
              {
                description: "Service",
                quantity: "1.00",
                amountIdr: "105.00",
                unitPriceIdr: "105.00",
                currency: "USD",
              },
            ],
          })
        )
      }

      if (url.includes("/api/billing/account")) {
        return jsonResponse(accountPayload("USD"))
      }

      if (url.includes("/api/payments/bank-accounts")) {
        return jsonResponse({ ok: true, accounts: [] })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() => {
      expect(view.getAllByText("$105.00").length).toBeGreaterThan(0)
      expect(view.queryByText(/IDR/)).not.toBeInTheDocument()
    })
  })

  it("formats top-up gap amount with the account currency", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            type: "SUBSCRIPTION",
            paymentMethod: "BANK_TRANSFER",
            currency: "IDR",
            subtotalAmountIdr: "100000.00",
            taxAmountIdr: "0.00",
            discountAmountIdr: "0.00",
            totalAmountIdr: "100000.00",
            lines: [
              {
                description: "Service",
                quantity: "1.00",
                amountIdr: "100000.00",
                unitPriceIdr: "100000.00",
                currency: "IDR",
              },
            ],
          })
        )
      }

      if (url.includes("/api/billing/account")) {
        return jsonResponse(accountPayload("USD"))
      }

      if (url.includes("/api/payments/bank-accounts")) {
        return jsonResponse({ ok: true, accounts: [] })
      }

      if (url.includes("/api/payments/invoice/topup-and-pay")) {
        return jsonResponse({
          ok: true,
          message: "Top-up required",
          topupRequired: true,
          gapAmount: 42.5,
          topupInvoiceId: "topup-1",
          topupInvoiceNumber: "TOP-1",
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() => {
      expect(
        view.getByRole("button", { name: /Top Up \+ Pay/ })
      ).toBeInTheDocument()
    })

    fireEvent.click(view.getByRole("button", { name: /Top Up \+ Pay/ }))

    await waitFor(() => {
      expect(view.getByText("Gap Amount")).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(view.getByText("$42.50")).toBeInTheDocument()
      expect(view.getByText("TOP-1")).toBeInTheDocument()
      expect(view.queryByText(/IDR\s*42\.50/)).not.toBeInTheDocument()
    })
  })
})
