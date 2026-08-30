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

describe("WhatsAppUsagePage — loading state", () => {
  it("renders quota capacity per device and skeleton values during loading", () => {
    const view = render(<WhatsAppUsagePage />)

    // Title should be visible
    expect(
      view.getByText("Quota Capacity per Device Number (1 Device = 1 Quota)")
    ).toBeTruthy()

    // At least one data-testid skeleton exists
    const skeletons = view.getAllByTestId("usage-value-skeleton")
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })
})
