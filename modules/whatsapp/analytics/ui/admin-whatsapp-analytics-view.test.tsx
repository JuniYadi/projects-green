import { describe, it, expect, beforeEach } from "bun:test"
import { cleanup, render, waitFor } from "@testing-library/react"
import { AdminWhatsappAnalyticsView } from "./admin-whatsapp-analytics-view"

describe("AdminWhatsappAnalyticsView component", () => {
  beforeEach(() => {
    cleanup()
  })

  it("exports AdminWhatsappAnalyticsView function component", () => {
    expect(typeof AdminWhatsappAnalyticsView).toBe("function")
  })

  it("renders with mocked fetch resolving analytics payload", async () => {
    const originalFetch = globalThis.fetch
    let syncCalled = false
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (url.includes("/sync") && init?.method === "POST") {
        syncCalled = true
        return {
          json: async () => ({ ok: true }),
        } as unknown as Response
      }
      if (url.includes("/summary")) {
        return {
          json: async () => ({
            ok: true,
            data: {
              period: { startDate: "2026-08-01", endDate: "2026-08-31" },
              kpi: {
                totalDeliveredMessages: 100,
                totalRevenueIdr: "100000",
                totalMetaBaseCostIdr: "50000",
                totalMetaVatCostIdr: "5500",
                totalMetaNetCostIdr: "55500",
                grossProfitIdr: "44500",
                grossMarginPct: "44.5",
                status: "HEALTHY",
              },
              categoryBreakdown: [],
            },
          }),
        } as unknown as Response
      }
      if (url.includes("/monthly-trends")) {
        return {
          json: async () => ({
            ok: true,
            data: [
              {
                month: "2026-08",
                deliveredMessages: 100,
                metaTotalCostIdr: 55500,
                revenueIdr: 100000,
                grossProfitIdr: 44500,
                marginPct: 44.5,
              },
            ],
          }),
        } as unknown as Response
      }
      return {
        json: async () => ({
          ok: true,
          data: [
            {
              organizationId: "org-1",
              organizationName: "Tenant Alpha",
              deviceCount: 1,
              totalDelivered: 100,
              metaBaseCostIdr: "50000",
              metaVatCostIdr: "5500",
              metaTotalCostIdr: "55500",
              revenueIdr: "100000",
              grossProfitIdr: "-1000",
              marginPct: "-1.0",
              marginStatus: "RISK",
            },
          ],
        }),
      } as unknown as Response
    }) as unknown as typeof fetch

    try {
      const view = render(<AdminWhatsappAnalyticsView />)
      await waitFor(() => {
        expect(view.getByText("WhatsApp Analytics & Profit")).toBeDefined()
        expect(view.getAllByText(/Tenant Alpha/).length).toBeGreaterThan(0)
        expect(view.getByText(/Peringatan Defisit Margin/)).toBeDefined()
      })

      const syncButton = view.getByRole("button", {
        name: /Sync Meta Pricing/i,
      })
      syncButton.click()
      await waitFor(() => {
        expect(syncCalled).toBe(true)
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("handles custom date range change properly", async () => {
    const originalFetch = globalThis.fetch
    const mockFetch = (async () => ({
      json: async () => ({
        ok: true,
        data: {
          period: { startDate: "2026-08-01", endDate: "2026-08-31" },
          kpi: {
            totalDeliveredMessages: 0,
            totalRevenueIdr: "0",
            totalMetaBaseCostIdr: "0",
            totalMetaVatCostIdr: "0",
            totalMetaNetCostIdr: "0",
            grossProfitIdr: "0",
            grossMarginPct: "0",
            status: "HEALTHY",
          },
          categoryBreakdown: [],
        },
      }),
    })) as unknown as typeof fetch
    globalThis.fetch = mockFetch
    if (typeof window !== "undefined") {
      window.fetch = mockFetch
    }

    try {
      const view = render(<AdminWhatsappAnalyticsView />)
      const select = view.container.querySelector("select")
      expect(select).toBeDefined()
      if (select) {
        select.value = "custom"
        select.dispatchEvent(new Event("change", { bubbles: true }))
      }
      await waitFor(() => {
        const dateInputs = view.container.querySelectorAll('input[type="date"]')
        expect(dateInputs.length).toBe(2)
      })
    } finally {
      globalThis.fetch = originalFetch
      if (typeof window !== "undefined") {
        window.fetch = originalFetch
      }
    }
  })
})
