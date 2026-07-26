/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockReplace = mock()
const mockSearchParamsToString = mock(() => "")

mock.module("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ toString: mockSearchParamsToString }),
  useParams: () => ({ lang: "en" }),
}))

const mockGetAdminOrgDetail = mock<(orgId: string) => Promise<any>>(
  async () => {
    throw new Error("not configured")
  }
)

const mockGetAdminUsage = mock(async () => ({
  ok: true,
  data: { breakdown: [], trend: [] },
}))

mock.module("@/lib/billing-client", () => ({
  getAdminOrgDetail: mockGetAdminOrgDetail,
  getAdminUsage: mockGetAdminUsage,
}))

const { OrgOverviewDashboard } = await import("./org-overview-dashboard")

const makeOrg = (overrides: Record<string, any> = {}) => ({
  orgId: "org_usd",
  orgName: "USD Org",
  balance: "125.00",
  currency: "USD",
  status: "ACTIVE",
  createdAt: "2024-01-01T00:00:00.000Z",
  subscriptions: [],
  contacts: 0,
  monthlySpend: "10.50",
  recentInvoices: [],
  ...overrides,
})

describe("OrgOverviewDashboard currency + tabs", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  it("renders USD-formatted balance inside the Billing tab and never uses Rp", async () => {
    mockGetAdminOrgDetail.mockResolvedValueOnce({
      ok: true,
      org: makeOrg(),
    })

    const view = render(
      <OrgOverviewDashboard lang="en" orgId="org_usd" defaultPage="billing" />
    )

    // Wait for the org name to appear in the header (rendered after fetch)
    await waitFor(() => expect(view.getByText("USD Org")).toBeTruthy())
    // Balance appears in the summary card and BalanceTab — both must use USD
    expect(view.getAllByText("USD 125.00").length).toBeGreaterThan(0)
    expect(view.container.innerHTML).not.toContain("Rp 125")
  })
})
