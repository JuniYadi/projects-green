import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const mockUseParams = mock(() => ({ id: "inv-1", lang: "en" }))
const mockUseSearchParams = mock(() => new URLSearchParams())

mock.module("next/navigation", () => ({
  useParams: mockUseParams,
  useSearchParams: mockUseSearchParams,
}))

import userEvent from "@testing-library/user-event"
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react"
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
    mockUseParams.mockReturnValue({ id: "inv-1", lang: "en" })
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
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
              accountName: "PT. Premium Fast Network",
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
    cleanup()
    globalThis.fetch = originalFetch
    document.body.innerHTML = ""
    document.body.style.pointerEvents = "auto"
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
    expect(
      view.getAllByText("PT. Premium Fast Network").length
    ).toBeGreaterThan(0)
    expect(
      view.getByRole("link", { name: "Confirm Payment" })
    ).toBeInTheDocument()
  })

  it("prominently calls out manual transfer confirmation", async () => {
    const view = render(<InvoiceDetailPage />)

    await waitFor(() =>
      expect(
        view.getByText("Transfer submitted? Confirm payment and upload receipt")
      ).toBeInTheDocument()
    )

    const link = view.getByRole("link", {
      name: /confirm payment and upload receipt/i,
    })
    expect(link.getAttribute("href")).toBe(
      "/en/console/billing/payments/confirm?invoiceId=inv-1"
    )
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

  it("renders continue payment button and payment reference for Duitku POP", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            paymentMethod: "QRIS",
            paymentReference: "duitku_ref_pop_123",
            checkoutMode: "POP",
            paymentUrl: "https://pay.example.test/inv-1",
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

    await waitFor(() =>
      expect(
        view.getByRole("button", { name: /continue payment/i })
      ).toBeInTheDocument()
    )

    expect(view.getAllByText("duitku_ref_pop_123").length).toBeGreaterThan(0)
    expect(view.getAllByText("Payment Reference").length).toBe(1)
    expect(
      view.getByText(/To close Duitku checkout, select ⋮ then Exit/)
    ).toBeInTheDocument()
    expect(
      view.getByText(/Opening it again resumes the same payment method/)
    ).toBeInTheDocument()
  })

  it("renders PARTIALLY_PAID status badge, financial breakdown, and allocation history", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            type: "SERVICE",
            status: "PARTIALLY_PAID",
            totalAmountIdr: "100000.00",
            totalPaid: 40000,
            remainingDue: 60000,
            allocations: [
              {
                id: "alloc-1",
                amount: 40000,
                currency: "IDR",
                source: "BALANCE",
                status: "COMPLETED",
                referenceId: "tx-bal-1",
                createdAt: "2026-09-25T10:00:00.000Z",
                completedAt: "2026-09-25T10:00:00.000Z",
              },
            ],
          })
        )
      }

      if (url.includes("/api/billing/account")) {
        return jsonResponse({
          ...accountPayload("IDR"),
          balanceIdr: "30000.00",
          formattedBalance: "Rp30.000",
        })
      }

      if (url.includes("/api/payments/bank-accounts")) {
        return jsonResponse({ ok: true, accounts: [] })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() =>
      expect(view.getAllByText("Partially Paid").length).toBeGreaterThan(0)
    )

    // Financial breakdown: Total Billed, Paid Amount, Remaining Due
    expect(view.getAllByText(/Remaining Due/i).length).toBeGreaterThan(0)
    expect(view.getAllByText(/Paid Amount/i).length).toBeGreaterThan(0)

    // History table
    expect(view.getByText("Payment Allocation History")).toBeInTheDocument()
    expect(view.getByText("BALANCE")).toBeInTheDocument()
    expect(view.getByText("tx-bal-1")).toBeInTheDocument()

    // Partial balance payment input should appear because balance > 0 and remainingDue > 0
    expect(
      view.getByRole("button", { name: /Pay Partially with Balance/i })
    ).toBeInTheDocument()
  })

  it("routes full-balance action through payPartialBalance when invoice is PARTIALLY_PAID", async () => {
    const requestedEndpoints: Array<{ url: string; body?: unknown }> = []

    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const body = init?.body ? JSON.parse(String(init.body)) : undefined
        requestedEndpoints.push({ url, body })

        if (url.includes("/api/billing/invoices/")) {
          return jsonResponse(
            invoicePayload({
              type: "SERVICE",
              status: "PARTIALLY_PAID",
              totalAmountIdr: "100000.00",
              totalPaid: 40000,
              remainingDue: 60000,
              allocations: [
                {
                  id: "alloc-1",
                  amount: 40000,
                  currency: "IDR",
                  source: "BALANCE",
                  status: "COMPLETED",
                  referenceId: "tx-bal-1",
                  createdAt: "2026-09-25T10:00:00.000Z",
                  completedAt: "2026-09-25T10:00:00.000Z",
                },
              ],
            })
          )
        }

        if (url.includes("/api/billing/account")) {
          return jsonResponse({
            ...accountPayload("IDR"),
            balanceIdr: "80000.00",
            formattedBalance: "Rp80.000",
          })
        }

        if (url.includes("/api/payments/invoice/pay-partial-balance")) {
          return jsonResponse({
            ok: true,
            message: "Invoice paid successfully.",
            invoiceStatus: "PAID",
            allocatedAmount: 60000,
            totalPaid: 100000,
            remainingDue: 0,
          })
        }

        if (url.includes("/api/payments/bank-accounts")) {
          return jsonResponse({ ok: true, accounts: [] })
        }

        return jsonResponse({ ok: false, message: "Unhandled" }, 500)
      }
    ) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() =>
      expect(view.getAllByText("Partially Paid").length).toBeGreaterThan(0)
    )

    const payWithBalanceBtn = view.getByRole("button", {
      name: /Pay with Balance/i,
    })
    expect(payWithBalanceBtn).toBeInTheDocument()

    fireEvent.click(payWithBalanceBtn)

    await waitFor(() => {
      const partialCall = requestedEndpoints.find((e) =>
        e.url.includes("/api/payments/invoice/pay-partial-balance")
      )
      expect(partialCall).toBeDefined()
      expect(partialCall?.body).toEqual({
        invoiceId: "inv-1",
        amountToUse: 60000,
      })
    })

    const fullBalanceCall = requestedEndpoints.find((e) =>
      e.url.includes("/api/payments/invoice/pay-with-balance")
    )
    expect(fullBalanceCall).toBeUndefined()
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
      expect(view.getAllByText("Total").length).toBeGreaterThan(0)
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

  it("renders payment method selector with default USD-compatible method and confirm link", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            currency: "USD",
            subtotalAmountIdr: "100.00",
            taxAmountIdr: "0.00",
            discountAmountIdr: "0.00",
            totalAmountIdr: "100.00",
            lines: [
              {
                description: "Top-up balance",
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
        return jsonResponse({
          ok: true,
          accounts: [
            {
              id: "bank-1",
              bankCode: "BCA",
              bankName: "Bank Central Asia",
              accountName: "PFN",
              accountNumber: "1234567890",
              isActive: true,
              isDefault: true,
              supportedCurrencies: ["USD", "IDR"],
            },
            {
              id: "bank-2",
              bankCode: "BRI",
              bankName: "Bank Rakyat Indonesia",
              accountName: "PFN2",
              accountNumber: "9876543210",
              isActive: true,
              isDefault: false,
              supportedCurrencies: ["USD"],
            },
          ],
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() =>
      expect(view.getByText("Bank Central Asia")).toBeInTheDocument()
    )

    expect(view.getByText("1234567890")).toBeInTheDocument()
    const confirmLink = view.getByRole("link", { name: "Confirm Payment" })
    expect(confirmLink).toHaveAttribute(
      "href",
      expect.stringContaining("paymentMethodId=bank-1")
    )
  })

  it("changing selector updates displayed account and link href", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            currency: "USD",
            subtotalAmountIdr: "100.00",
            taxAmountIdr: "0.00",
            discountAmountIdr: "0.00",
            totalAmountIdr: "100.00",
            lines: [
              {
                description: "Top-up balance",
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
        return jsonResponse({
          ok: true,
          accounts: [
            {
              id: "bank-1",
              bankCode: "BCA",
              bankName: "Bank Central Asia",
              accountName: "PFN",
              accountNumber: "1234567890",
              isActive: true,
              isDefault: true,
              supportedCurrencies: ["USD", "IDR"],
            },
            {
              id: "bank-2",
              bankCode: "BRI",
              bankName: "Bank Rakyat Indonesia",
              accountName: "PFN2",
              accountNumber: "9876543210",
              isActive: true,
              isDefault: false,
              supportedCurrencies: ["USD"],
            },
          ],
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() =>
      expect(view.getByText("Bank Central Asia")).toBeInTheDocument()
    )

    const combobox = view.getByRole("combobox", { name: /payment method/i })
    await userEvent.click(combobox)
    await userEvent.click(
      view.getByRole("option", { name: "Bank Rakyat Indonesia — 9876543210" })
    )

    await waitFor(() => {
      expect(view.getByText("9876543210")).toBeInTheDocument()
      const confirmLink = view.getByRole("link", { name: "Confirm Payment" })
      expect(confirmLink).toHaveAttribute(
        "href",
        expect.stringContaining("paymentMethodId=bank-2")
      )
    })
  })

  it("shows empty state and no confirm link when no compatible method", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            currency: "USD",
            subtotalAmountIdr: "100.00",
            taxAmountIdr: "0.00",
            discountAmountIdr: "0.00",
            totalAmountIdr: "100.00",
            lines: [
              {
                description: "Top-up balance",
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
        return jsonResponse({
          ok: true,
          accounts: [
            {
              id: "bank-idr",
              bankCode: "MANDIRI",
              bankName: "Bank Mandiri",
              accountName: "PFN",
              accountNumber: "5555555555",
              isActive: true,
              isDefault: true,
              supportedCurrencies: ["IDR"],
            },
          ],
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() => {
      expect(
        view.getByText(
          "No active payment method supports USD. Contact support before transferring this payment."
        )
      ).toBeInTheDocument()
      expect(
        view.queryByRole("link", { name: "Confirm Payment" })
      ).not.toBeInTheDocument()
    })
  })

  it("detects pending payment confirmation, displays pending notice, and disables re-confirmation", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse(
          invoicePayload({
            confirmations: [
              {
                id: "conf-1",
                status: "PENDING",
                createdAt: "2026-05-02T10:00:00.000Z",
                amount: 299000,
              },
            ],
          })
        )
      }

      if (url.includes("/api/billing/account")) {
        return jsonResponse(accountPayload("IDR"))
      }

      if (url.includes("/api/payments/bank-accounts")) {
        return jsonResponse({
          ok: true,
          accounts: [
            {
              id: "bank-1",
              bankCode: "BCA",
              bankName: "Bank Central Asia",
              accountName: "PT Projects Green",
              accountNumber: "1234567890",
              isActive: true,
              isDefault: true,
              supportedCurrencies: ["IDR"],
            },
          ],
        })
      }

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailPage />)

    await waitFor(() => {
      // Pending confirmation banner is displayed
      expect(
        view.getByText(/Payment Confirmation — PENDING/i)
      ).toBeInTheDocument()
      // Transfer prompt card is hidden when already pending
      expect(
        view.queryByText(
          /Transfer already sent\? Confirm payment and upload receipt/i
        )
      ).not.toBeInTheDocument()
      // Re-confirmation button is disabled
      const alreadyConfirmedBtn = view.getByRole("button", {
        name: /This payment has already been confirmed/i,
      })
      expect(alreadyConfirmedBtn).toBeDisabled()
    })
  })
})
