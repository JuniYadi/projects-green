import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockGetAdminStats = mock<
  () => Promise<{
    ok: true
    totalBalance: string
    activeOrgs: number
    totalSpend: string
    lowBalanceOrgs: number
    openInvoices: number
    openTickets: number
  }>
>(async () => {
  throw new Error("not configured")
})

mock.module("@/lib/billing-client", () => ({
  getAdminStats: mockGetAdminStats,
}))

const { PlatformStatsCards } = await import("./platform-stats-cards")

describe("PlatformStatsCards mixed currency", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("shows Mixed currencies for total balance and IDR-formatted total spend", async () => {
    mockGetAdminStats.mockResolvedValueOnce({
      ok: true,
      totalBalance: "999.00",
      activeOrgs: 2,
      totalSpend: "5000.00",
      lowBalanceOrgs: 1,
      openInvoices: 0,
      openTickets: 0,
    })

    const view = render(<PlatformStatsCards />)

    await waitFor(() => expect(view.getByText("Mixed currencies")).toBeTruthy())
    expect(view.getByText("IDR 5.000,00")).toBeTruthy()
    expect(view.container.innerHTML).not.toContain("Rp 999")
  })
})
