import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockRouterRefresh = mock(() => {})
const originalFetch = globalThis.fetch

mock.module("next/navigation", () => {
  return {
    useRouter: () => ({
      refresh: mockRouterRefresh,
      replace: () => {},
      push: () => {},
      prefetch: async () => undefined,
    }),
  }
})

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })
}

describe("InvoiceDetailPage", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes("/api/invoices/inv_1")) {
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

      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    mockRouterRefresh.mockClear()
    globalThis.fetch = originalFetch
  })

  it("renders invoice detail from API data", async () => {
    const { default: InvoiceDetailPage } = await import(
      "@/app/[lang]/console/invoices/[invoiceId]/page"
    )

    const ui = await InvoiceDetailPage({
      params: Promise.resolve({ lang: "en", invoiceId: "inv_1" }),
    })

    const view = render(ui)

    expect(
      view.getByRole("heading", {
        name: "Invoice Detail",
      })
    ).toBeTruthy()

    await waitFor(() => {
      expect(view.getByText("Overview")).toBeTruthy()
      expect(view.getAllByText("INV-2026-0001").length).toBeGreaterThan(0)
      expect(view.getByText("Mark Invoice Canceled")).toBeTruthy()
      expect(view.getByText("Pay Invoice")).toBeTruthy()
    })
  })
})
