import { describe, it, expect, mock } from "bun:test"
import { render } from "@testing-library/react"

// Mock the whatsappClient module at the top before any imports
const mockOverview = mock(() => new Promise(() => {})) // never resolves — keeps loading state
const mockDaily = mock(() => new Promise(() => {}))
const mockDevices = mock(() => new Promise(() => {}))
const mockCostBreakdown = mock(() => new Promise(() => {}))
const mockMonthly = mock(() => new Promise(() => {}))
const mockLedger = mock(() => new Promise(() => {}))

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    usage: {
      overview: mockOverview,
      daily: mockDaily,
      costBreakdown: mockCostBreakdown,
      monthly: mockMonthly,
      ledger: mockLedger,
    },
    devices: {
      list: mockDevices,
    },
  },
}))
// Import after mock setup
import WhatsAppUsagePage from "./page"

describe("WhatsAppUsagePage", () => {
  it("renders quota capacity per device and skeleton values during loading", () => {
    const view = render(<WhatsAppUsagePage />)

    expect(
      view.getByText("Quota Capacity per Device Number (1 Device = 1 Quota)")
    ).toBeTruthy()

    const skeletons = view.getAllByTestId("usage-value-skeleton")
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it("renders pure-SVG traffic trend and category donut when loaded", async () => {
    mockOverview.mockImplementation(() =>
      Promise.resolve({
        month: [{ messageInboxCount: 10, messageOutboxCount: 20 }],
        cost: {
          totalAmount: 50000,
          totalEntries: 2,
          byCategory: [
            { category: "MARKETING", count: 15, totalCost: 35000 },
            { category: "UTILITY", count: 5, totalCost: 15000 },
          ],
        },
      })
    )
    mockDaily.mockImplementation(() =>
      Promise.resolve({
        counts: [
          {
            date: "2026-09-07T00:00:00.000Z",
            messageInboxCount: 5,
            messageOutboxCount: 10,
          },
          {
            date: "2026-09-08T00:00:00.000Z",
            messageInboxCount: 8,
            messageOutboxCount: 12,
          },
        ],
      })
    )
    mockDevices.mockImplementation(() =>
      Promise.resolve({
        devices: [
          {
            id: "dev-1",
            phoneNumber: "+628123456789",
            status: "CONNECTED",
          },
        ],
      })
    )
    mockCostBreakdown.mockImplementation(() =>
      Promise.resolve({
        totalCost: 50000,
        byDevice: [
          {
            deviceId: "dev-1",
            phoneNumber: "+628123456789",
            messageCount: 10,
            quotaBase: 1000,
            quotaBaseOut: 800,
            quotaUsed: 200,
            addonQuota: 0,
            addonQuotaTotal: 0,
            totalCost: 50000,
          },
        ],
      })
    )
    mockMonthly.mockImplementation(() =>
      Promise.resolve({
        counts: [
          {
            year: 2026,
            month: 9,
            messageInboxCount: 10,
            messageOutboxCount: 20,
          },
        ],
      })
    )
    mockLedger.mockImplementation(() => Promise.resolve({ data: [] }))

    const view = render(<WhatsAppUsagePage />)

    const { waitFor } = await import("@testing-library/react")
    await waitFor(() => {
      const svgs = view.container.querySelectorAll("svg")
      expect(svgs.length).toBeGreaterThanOrEqual(2)
      expect(
        view.getByText(/Tren Volume Pesan|Message Volume Trend/i)
      ).toBeDefined()
      expect(
        view.getByText(/Komposisi Kategori Pesan|Category Composition/i)
      ).toBeDefined()
    })
  })
})
