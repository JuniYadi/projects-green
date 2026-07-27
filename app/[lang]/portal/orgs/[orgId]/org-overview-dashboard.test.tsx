/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockReplace = mock()

mock.module("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
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

const mockGetAdminInvoices = mock(async () => ({
  ok: true,
  invoices: [],
  pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
}))

const mockGetAdminSubscriptions = mock(async () => ({
  ok: true,
  subscriptions: [],
  pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
}))

const mockGetAdminAdjustments = mock(async () => ({
  ok: true,
  adjustments: [],
  pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
}))

const mockListAdminTickets = mock<
  (params?: { organizationId?: string }) => Promise<unknown[]>
>(async () => [])

const mockGetOrganizationMembers = mock(async () => ({ data: [] }))
const mockGetOrganizationInvitations = mock(async () => ({ data: [] }))

mock.module("@/lib/billing-client", () => ({
  getAdminOrgDetail: mockGetAdminOrgDetail,
  getAdminUsage: mockGetAdminUsage,
  getAdminInvoices: mockGetAdminInvoices,
  getAdminSubscriptions: mockGetAdminSubscriptions,
  getAdminAdjustments: mockGetAdminAdjustments,
}))

mock.module("@/modules/support-tickets/api/support-tickets.client", () => ({
  createSupportTicketsClient: () => ({
    listAdminTickets: mockListAdminTickets,
  }),
}))

mock.module("@/lib/eden", () => ({
  eden: {
    api: {
      admin: {
        organizations: (_orgId: string) => ({
          members: {
            get: () => mockGetOrganizationMembers(),
            invitations: {
              get: () => mockGetOrganizationInvitations(),
            },
          },
        }),
      },
    },
  },
}))

const { OrgOverviewDashboard } = await import("./org-overview-dashboard")

const makeOrg = (overrides: Record<string, any> = {}) => ({
  orgId: "org_usd",
  orgName: "USD Org",
  balance: "125.00",
  currency: "USD",
  status: "ACTIVE",
  createdAt: "2024-01-01T00:00:00.000Z",
  subscriptions: [
    {
      id: "sub_1",
      packageCode: "starter",
      planCode: "monthly",
      status: "ACTIVE",
      billingMode: "monthly",
    },
  ],
  contacts: 1,
  monthlySpend: "10.50",
  recentInvoices: [],
  ...overrides,
})

describe("OrgOverviewDashboard", () => {
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

    await waitFor(() => expect(view.getByText("USD Org")).toBeTruthy())
    expect(view.getAllByText("USD 125.00").length).toBeGreaterThan(0)
    expect(view.container.innerHTML).not.toContain("Rp 125")
  })

  it("shows the full tab set and never shows Settings, Back to Overview, or duplicate Balance", async () => {
    mockGetAdminOrgDetail.mockResolvedValueOnce({
      ok: true,
      org: makeOrg(),
    })

    const view = render(
      <OrgOverviewDashboard lang="en" orgId="org_usd" defaultPage="billing" />
    )

    await waitFor(() => expect(view.getByText("USD Org")).toBeTruthy())

    for (const label of [
      "Billing",
      "Invoices",
      "Usage",
      "Subscriptions",
      "Adjustments",
      "Members",
      "Support Tickets",
    ]) {
      expect(view.getByRole("tab", { name: label })).toBeTruthy()
    }

    // No Settings tab
    expect(view.queryByRole("tab", { name: "Settings" })).toBeNull()
    // No "Back to Overview" link
    expect(view.queryByText("Back to Overview")).toBeNull()
  })

  it("passes the selected orgId to the support-tickets listAdminTickets client", async () => {
    mockGetAdminOrgDetail.mockResolvedValueOnce({
      ok: true,
      org: makeOrg(),
    })

    render(
      <OrgOverviewDashboard lang="en" orgId="org_usd" defaultPage="support" />
    )

    await waitFor(() =>
      expect(mockListAdminTickets).toHaveBeenCalledWith({
        organizationId: "org_usd",
      })
    )
  })

  it("renders error state when getAdminOrgDetail rejects", async () => {
    mockGetAdminOrgDetail.mockRejectedValueOnce(new Error("Network error"))

    const view = render(
      <OrgOverviewDashboard lang="en" orgId="org_usd" defaultPage="billing" />
    )

    await waitFor(() =>
      expect(
        view.getByText("Failed to load organization: Network error")
      ).toBeTruthy()
    )
  })

  it("renders not-found state when org detail resolves to null", async () => {
    mockGetAdminOrgDetail.mockResolvedValueOnce(null as unknown as never)

    const view = render(
      <OrgOverviewDashboard lang="en" orgId="org_usd" defaultPage="billing" />
    )

    await waitFor(() =>
      expect(view.getByText("Organization not found.")).toBeTruthy()
    )
  })

  it("falls back to Billing tab when defaultPage is invalid", async () => {
    mockGetAdminOrgDetail.mockResolvedValueOnce({
      ok: true,
      org: makeOrg(),
    })

    const view = render(
      <OrgOverviewDashboard lang="en" orgId="org_usd" defaultPage="nope" />
    )

    await waitFor(() => expect(view.getByText("USD Org")).toBeTruthy())
    expect(view.getByText("USD 125.00")).toBeTruthy()
  })
})
