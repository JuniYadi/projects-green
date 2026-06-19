import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { fireEvent, render, waitFor } from "@testing-library/react"

import { InvoiceDetailScreen } from "@/modules/invoices/ui/invoice-detail-screen"

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

describe("InvoiceDetailScreen", () => {
  let mockRouterRefresh: ReturnType<typeof mock>

  beforeEach(() => {
    mockRouterRefresh = mock(() => {})
    ;(useRouter as ReturnType<typeof mock>).mockReturnValue({
      refresh: mockRouterRefresh,
    })
    ;(usePathname as ReturnType<typeof mock>).mockReturnValue(
      "/en/console/invoices/inv_1"
    )
    ;(useSearchParams as ReturnType<typeof mock>).mockReturnValue(
      new URLSearchParams()
    )

    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? "GET"

        if (method === "GET" && url.includes("/api/invoices/inv_1")) {
          return jsonResponse({
            ok: true,
            canMarkCanceled: true,
            invoice: {
              id: "inv_1",
              invoiceNumber: "INV-2026-0001",
              issuedAt: "2026-05-02T00:00:00.000Z",
              dueAt: "2026-05-17T00:00:00.000Z",
              totalAmount: 110,
              currency: "USD",
              status: "open",
              subtotalAmount: 100,
              taxAmount: 10,
              discountAmount: 0,
              periodStart: "2026-05-01T00:00:00.000Z",
              periodEnd: "2026-05-31T23:59:59.000Z",
              paidAt: null,
              lineItems: [
                {
                  id: "line_1",
                  description: "Pro Plan",
                  quantity: 1,
                  unitPrice: 100,
                  amount: 100,
                  currency: "USD",
                },
              ],
            },
          })
        }

        if (method === "POST" && url.includes("/api/invoices/inv_1/cancel")) {
          return jsonResponse({
            ok: true,
            invoice: {
              id: "inv_1",
              invoiceNumber: "INV-2026-0001",
              issuedAt: "2026-05-02T00:00:00.000Z",
              dueAt: "2026-05-17T00:00:00.000Z",
              totalAmount: 110,
              currency: "USD",
              status: "canceled",
              subtotalAmount: 100,
              taxAmount: 10,
              discountAmount: 0,
              periodStart: "2026-05-01T00:00:00.000Z",
              periodEnd: "2026-05-31T23:59:59.000Z",
              paidAt: null,
              lineItems: [
                {
                  id: "line_1",
                  description: "Pro Plan",
                  quantity: 1,
                  unitPrice: 100,
                  amount: 100,
                  currency: "USD",
                },
              ],
            },
          })
        }

        if (method === "GET" && url.includes("/api/invoices/inv_1/pdf")) {
          return new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
            },
          })
        }

        return jsonResponse({ ok: false, message: "Unhandled" }, 500)
      }
    ) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("renders invoice actions and handles payment/cancel interactions", async () => {
    const view = render(<InvoiceDetailScreen invoiceId="inv_1" lang="en" />)

    await waitFor(() => {
      expect(view.getByText("Invoice Actions")).toBeTruthy()
      expect(view.getByText("Mark Invoice Canceled")).toBeTruthy()
    })

    fireEvent.click(view.getByText("Pay Invoice"))

    await waitFor(() => {
      expect(view.getByText(/confirm your payment/i)).toBeTruthy()
      expect(view.getByRole("button", { name: "Confirm Payment" })).toBeTruthy()
    })

    fireEvent.click(view.getByText("Mark Invoice Canceled"))
    fireEvent.click(view.getByRole("button", { name: "Confirm Canceled" }))

    await waitFor(() => {
      expect(mockRouterRefresh).toHaveBeenCalled()
      expect(view.getAllByText("Canceled").length).toBeGreaterThan(0)
    })
  })

  it("shows loading skeleton initially", () => {
    // Don't resolve fetch — component starts in loading state
    globalThis.fetch = mock(
      () => new Promise(() => {})
    ) as unknown as typeof fetch

    const view = render(<InvoiceDetailScreen invoiceId="inv_1" lang="en" />)

    expect(view.getByTestId("invoice-detail-skeleton")).toBeTruthy()
  })

  it("shows error state when API returns error", async () => {
    // Return 404 with no message so the generic fallback is used
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ ok: false, error: "NOT_FOUND" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch

    const view = render(<InvoiceDetailScreen invoiceId="inv_1" lang="en" />)

    expect(await view.findByText(/unable to load/i)).toBeTruthy()
  })
})
