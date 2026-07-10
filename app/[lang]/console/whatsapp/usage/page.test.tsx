import { describe, it, expect, mock } from "bun:test"
import { render } from "@testing-library/react"

// Mock the whatsappClient module at the top before any imports
const mockOverview = mock(() => new Promise(() => {})) // never resolves — keeps loading state
const mockDaily = mock(() => new Promise(() => {}))
const mockDevices = mock(() => new Promise(() => {}))
const mockCostBreakdown = mock(() => new Promise(() => {}))
const mockMonthly = mock(() => new Promise(() => {}))

mock.module("@/lib/api/whatsapp-client", () => ({
  whatsappClient: {
    usage: {
      overview: mockOverview,
      daily: mockDaily,
      costBreakdown: mockCostBreakdown,
      monthly: mockMonthly,
    },
    devices: {
      list: mockDevices,
    },
  },
}))
// Import after mock setup
import WhatsAppUsagePage from "./page"

describe("WhatsAppUsagePage — loading state", () => {
  it("renders eight card titles and skeleton values during loading", () => {
    const view = render(<WhatsAppUsagePage />)

    // All eight card titles should be visible
    expect(view.getByText("Total Messages")).toBeTruthy()
    expect(view.getByText("Inbound Count")).toBeTruthy()
    expect(view.getByText("Outbound Count")).toBeTruthy()
    expect(view.getByText("Total Cost")).toBeTruthy()
    expect(view.getByText("Monthly Quota Used")).toBeTruthy()
    expect(view.getByText("Remaining Quota")).toBeTruthy()
    expect(view.getByText("Projected Cost")).toBeTruthy()
    expect(view.getByText("Balance")).toBeTruthy()

    // At least one data-testid skeleton exists
    const skeletons = view.getAllByTestId("usage-value-skeleton")
    expect(skeletons.length).toBeGreaterThanOrEqual(8)
  })
})
