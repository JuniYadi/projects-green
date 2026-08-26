import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockUseParams = mock(() => ({ lang: "en", id: "sub-1" }))
mock.module("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mock() }),
  usePathname: () => "/en/console/billing/subscriptions/sub-1",
}))

import SubscriptionDetailPage from "./page"
const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <SubscriptionDetailPage />
    </QueryClientProvider>
  )
}

const originalFetch = globalThis.fetch

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  })

describe("SubscriptionDetailPage", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mockUseParams.mockReturnValue({
      lang: "en",
      id: "sub-1",
    })
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/billing/subscriptions")) {
        return jsonResponse({
          ok: true,
          subscriptions: [
            {
              id: "sub-1",
              packageCode: "WHATSAPP",
              planCode: "WHATSAPP_STANDARD",
              regionCode: "GLOBAL",
              billingMode: "SUBSCRIPTION",
              type: "STANDARD",
              status: "ACTIVE",
              allocatedConfig: null,
              monthlyRateIdr: "299000.00",
              periodPrice: "299000.00",
              billingPeriod: "MONTHLY",
              currentPeriodEnd: "2026-07-15T00:00:00Z",
              orderId: "ord-1",
              orderStatus: "CHARGED",
              billingInvoiceId: "inv-1",
              invoiceStatus: "PAID",
            },
          ],
        })
      }
      if (url.includes("/api/billing/catalog/")) {
        return jsonResponse({
          ok: true,
          code: "WHATSAPP",
          name: "WhatsApp",
          description: null,
          plans: [],
        })
      }
      if (url.includes("/api/billing/invoices/")) {
        return jsonResponse({
          ok: true,
          invoice: {
            id: "inv-1",
            invoiceNumber: "INV-2026-001",
            status: "PAID",
            type: "SUBSCRIPTION",
            paymentMethod: null,
            paymentUrl: null,
            issuedAt: "2026-06-01T00:00:00.000Z",
            dueAt: "2026-06-15T00:00:00.000Z",
            periodStart: "2026-06-01T00:00:00.000Z",
            periodEnd: "2026-07-01T00:00:00.000Z",
            subtotalAmountIdr: "299000.00",
            taxAmountIdr: "0",
            discountAmountIdr: "0",
            totalAmountIdr: "299000.00",
            currency: "IDR",
            lines: [],
          },
        })
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("shows loading state initially", () => {
    const view = renderPage()
    expect(
      view.container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
  })

  it("shows not found when subscription does not exist", async () => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/billing/subscriptions")) {
        return jsonResponse({ ok: true, subscriptions: [] })
      }
      return jsonResponse({ ok: true, invoice: null })
    }) as unknown as typeof fetch

    const view = renderPage()

    await waitFor(() =>
      expect(view.getByText(/Invoice Not Found/i)).toBeInTheDocument()
    )
  })

  it("shows error state on fetch failure", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("Network error")
    }) as unknown as typeof fetch

    const view = renderPage()

    await waitFor(() =>
      expect(view.getByText(/Network error/i)).toBeInTheDocument()
    )
  })
  it("renders subscription detail hero with active status", async () => {
    const view = renderPage()

    await waitFor(() => {
      expect(view.getByText("WhatsApp Business")).toBeInTheDocument()
      expect(view.getAllByText(/WHATSAPP_STANDARD/).length).toBeGreaterThan(0)
      expect(view.getAllByText(/Active|ACTIVE/i).length).toBeGreaterThan(0)
    })
  })
  it("renders subscription summary table rows directly", async () => {
    const view = renderPage()

    await waitFor(() => {
      expect(
        view.getAllByText(/Rincian Langganan|Subscription & Renewal Details/i)
          .length
      ).toBeGreaterThan(0)
      expect(
        view.getAllByText(/Data Formulir|Signup Form Data/i).length
      ).toBeGreaterThan(0)
      expect(
        view.getAllByText(/Tanggal Perpanjangan|Next Renewal|Renewal/i).length
      ).toBeGreaterThan(0)
    })
  })

  it("shows back to subscriptions link", async () => {
    const view = renderPage()

    await waitFor(() =>
      expect(
        view.getByRole("link", {
          name: /Kembali ke Subscriptions|Back to Subscriptions/i,
        })
      ).toBeInTheDocument()
    )
  })
  it("shows exact renewal date", async () => {
    const view = renderPage()

    await waitFor(() =>
      expect(
        view.getAllByText(/July 15, 2026|15 Juli 2026/i).length
      ).toBeGreaterThan(0)
    )
  })
})
