import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockGetAdminUsage = mock<
  (params?: { days?: number; orgId?: string }) => Promise<{
    ok: true
    data: {
      breakdown: Array<{
        category: string
        quantity: number
        totalCost: number
        percentage: number
      }>
      trend: Array<{ date: string; amount: number }>
    }
  }>
>(async () => {
  throw new Error("not configured")
})

mock.module("@/lib/billing-client", () => ({
  getAdminUsage: mockGetAdminUsage,
}))

mock.module("recharts", () => ({
  Bar: () => <div data-testid="bar" />,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
}))

mock.module("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}))

mock.module("@phosphor-icons/react", () => ({
  CurrencyDollarIcon: () => <span data-testid="currency-icon" />,
  LightningIcon: () => <span data-testid="lightning-icon" />,
}))

const { UsageTab } = await import("./usage-tab")

describe("UsageTab", () => {
  beforeEach(() => {
    mockGetAdminUsage.mockReset()
  })

  it("renders skeleton while loading", () => {
    const { promise } = Promise.withResolvers<never>()
    mockGetAdminUsage.mockReturnValueOnce(promise)

    const view = render(<UsageTab orgId="org_1" />)

    expect(
      view.container.querySelectorAll(".animate-pulse").length
    ).toBeGreaterThan(0)
  })

  it("renders error state on rejection", async () => {
    mockGetAdminUsage.mockRejectedValueOnce(new Error("network"))

    const view = render(<UsageTab orgId="org_1" />)

    await waitFor(() =>
      expect(view.getByText("Failed to load usage: network")).toBeTruthy()
    )
  })

  it("renders summary, breakdown, and trend on success", async () => {
    mockGetAdminUsage.mockResolvedValueOnce({
      ok: true,
      data: {
        breakdown: [
          {
            category: "vpn",
            quantity: 100,
            totalCost: 50000,
            percentage: 60,
          },
        ],
        trend: [
          { date: "2026-07-01", amount: 5000 },
          { date: "2026-07-02", amount: 7000 },
        ],
      },
    })

    const view = render(<UsageTab orgId="org_1" />)

    await waitFor(() => expect(view.getByText("Total Cost")).toBeTruthy())
    expect(view.getByText("Total Events")).toBeTruthy()
    expect(view.getByText("Services Used")).toBeTruthy()
    expect(view.getByText("Daily Average")).toBeTruthy()
    expect(view.getByText("vpn")).toBeTruthy()
    expect(view.getByText("100")).toBeTruthy()
    expect(view.getByText("60.0%")).toBeTruthy()
    expect(view.getByText("Cost by Service")).toBeTruthy()
    expect(view.getAllByText("IDR 50.000,00").length).toBeGreaterThan(0)
    expect(view.getByText("Daily Trend (Last 30 Days)")).toBeTruthy()
  })

  it("renders empty state when no data", async () => {
    mockGetAdminUsage.mockResolvedValueOnce({
      ok: true,
      data: { breakdown: [], trend: [] },
    })

    const view = render(<UsageTab orgId="org_1" />)

    await waitFor(() =>
      expect(view.getByText("No usage data for this period.")).toBeTruthy()
    )
    expect(view.getAllByText("IDR 0,00").length).toBeGreaterThan(0)
  })
})
