import "@/test/register"
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, waitFor } from "@testing-library/react"
import { useParams } from "next/navigation"

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
  beforeEach(() => {
    ;(useParams as ReturnType<typeof mock>).mockReturnValue({
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

  it("renders subscription detail with overview tab", async () => {
    const view = renderPage()

    await waitFor(() => {
      expect(view.getAllByText("WHATSAPP").length).toBeGreaterThan(0)
      expect(view.getAllByText("WHATSAPP_STANDARD").length).toBeGreaterThan(0)
      expect(view.getAllByText("Active").length).toBeGreaterThan(0)
    })
  })

  it("renders billing tab with invoice data", async () => {
    const view = renderPage()

    await waitFor(() =>
      expect(view.getByRole("tab", { name: "Billing" })).toBeInTheDocument()
    )
    const billingTab = view.getByRole("tab", { name: "Billing" })
    fireEvent.mouseDown(billingTab, { button: 0, ctrlKey: false })
    fireEvent.click(billingTab)

    await waitFor(() => {
      expect(view.getByText("INV-2026-001")).toBeInTheDocument()
      expect(view.getByText("PAID")).toBeInTheDocument()
    })
  })

  it("shows tabs for overview, billing, add-ons, and activity", async () => {
    const view = renderPage()

    await waitFor(() => {
      expect(view.getByRole("tab", { name: "Overview" })).toBeInTheDocument()
      expect(view.getByRole("tab", { name: "Billing" })).toBeInTheDocument()
      expect(view.getByRole("tab", { name: "Add-ons" })).toBeInTheDocument()
      expect(view.getByRole("tab", { name: "Activity" })).toBeInTheDocument()
    })
  })

  it("shows add-ons unavailable state", async () => {
    const view = renderPage()

    await waitFor(() =>
      expect(view.getByRole("tab", { name: "Add-ons" })).toBeInTheDocument()
    )
    const addonsTab = view.getByRole("tab", { name: "Add-ons" })
    fireEvent.mouseDown(addonsTab, { button: 0, ctrlKey: false })
    fireEvent.click(addonsTab)

    await waitFor(() =>
      expect(view.getByText("Add-ons Unavailable")).toBeInTheDocument()
    )
  })

  it("shows activity tab with no activity message", async () => {
    const view = renderPage()

    await waitFor(() =>
      expect(view.getByRole("tab", { name: "Activity" })).toBeInTheDocument()
    )
    const activityTab = view.getByRole("tab", { name: "Activity" })
    fireEvent.mouseDown(activityTab, { button: 0, ctrlKey: false })
    fireEvent.click(activityTab)

    await waitFor(() =>
      expect(view.getByText("No recent activity.")).toBeInTheDocument()
    )
  })

  it("shows back to subscriptions link", async () => {
    const view = renderPage()

    await waitFor(() =>
      expect(
        view.getByRole("link", { name: /Back to subscriptions/i })
      ).toBeInTheDocument()
    )
  })

  it("shows exact renewal date", async () => {
    const view = renderPage()

    await waitFor(() =>
      expect(view.getByText("July 15, 2026")).toBeInTheDocument()
    )
  })
})
