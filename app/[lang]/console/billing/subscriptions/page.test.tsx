import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, waitFor } from "@testing-library/react"

import SubscriptionsPage from "./page"

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <SubscriptionsPage />
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

afterEach(() => {
  cleanup()
})

describe("SubscriptionsPage", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/billing/subscriptions")) {
        return jsonResponse({ ok: true, subscriptions: [] })
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

  it("shows empty state when no subscriptions match", async () => {
    const view = renderPage()

    await waitFor(() =>
      expect(view.getByText("No subscriptions found")).toBeInTheDocument()
    )
  })

  it("shows search and filter controls", async () => {
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
            },
          ],
        })
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = renderPage()

    await waitFor(() => {
      expect(
        view.getAllByPlaceholderText("Search subscriptions...").length
      ).toBeGreaterThan(0)
      expect(view.getByRole("combobox")).toBeInTheDocument()
    })
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

  it("renders subscription data in the list", async () => {
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
              invoiceStatus: "PAID",
            },
          ],
        })
      }
      return jsonResponse({ ok: false, message: "Unhandled" }, 500)
    }) as unknown as typeof fetch

    const view = renderPage()

    await waitFor(() => {
      expect(view.getAllByText("WHATSAPP").length).toBeGreaterThan(0)
      expect(view.getAllByText("WHATSAPP_STANDARD").length).toBeGreaterThan(0)
      expect(view.getAllByText(/Active|ACTIVE/i).length).toBeGreaterThan(0)
    })
  })
})
