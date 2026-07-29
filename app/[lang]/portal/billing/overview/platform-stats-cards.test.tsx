import { describe, expect, it, mock } from "bun:test"
import { render } from "@testing-library/react"

const mockGetAdminStats = mock(async () => ({
  ok: true as const,
  totalBalances: { IDR: "50000.00", USD: "25.00" },
  activeOrgs: 2,
  totalSpend: "1000.00",
  lowBalanceOrgs: 0,
  openInvoices: 1,
  openTickets: 0,
}))

mock.module("@/lib/billing-client", () => ({
  getAdminStats: mockGetAdminStats,
}))

const { PlatformStatsCards } = await import("./platform-stats-cards")

describe("PlatformStatsCards", () => {
  it("renders IDR and USD total balances without Mixed currencies", async () => {
    const view = render(<PlatformStatsCards />)

    expect(await view.findByText("IDR 50.000,00")).toBeTruthy()
    expect(view.getByText("USD 25.00")).toBeTruthy()
    expect(view.queryByText("Mixed currencies")).toBeNull()
  })
})
