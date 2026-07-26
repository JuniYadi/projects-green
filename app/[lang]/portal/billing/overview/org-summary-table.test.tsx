 
import { describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockGetAdminOrgs = mock<
  (params?: { page?: number; limit?: number }) => Promise<{
    ok: true
    orgs: Array<{
      orgId: string
      orgName: string
      balance: string
      currency: string
      activeSubscriptions: number
      monthlySpend: string
      lastTopUp: string | null
      openTicketCount: number
    }>
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
>(async () => ({
  ok: true as const,
  orgs: [],
  pagination: { page: 1, limit: 100, total: 0, totalPages: 1 },
}))

mock.module("@/lib/billing-client", () => ({
  getAdminOrgs: mockGetAdminOrgs,
}))

const { OrgSummaryTable } = await import("./org-summary-table")

describe("OrgSummaryTable currency formatting", () => {
  it("renders per-row USD and IDR with correct grouping", async () => {
    mockGetAdminOrgs.mockResolvedValueOnce({
      ok: true,
      orgs: [
        {
          orgId: "org_usd",
          orgName: "USD Org",
          balance: "125.00",
          currency: "USD",
          activeSubscriptions: 1,
          monthlySpend: "10.50",
          lastTopUp: null,
          openTicketCount: 0,
        },
        {
          orgId: "org_idr",
          orgName: "IDR Org",
          balance: "125000.00",
          currency: "IDR",
          activeSubscriptions: 0,
          monthlySpend: "5000.00",
          lastTopUp: null,
          openTicketCount: 0,
        },
      ],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    })

    const view = render(
      <OrgSummaryTable
        linkPrefix="/portal/orgs"
        linkSuffix="?page=billing"
        limit={100}
      />
    )

    await waitFor(() => expect(view.getByText("USD Org")).toBeTruthy())
    expect(view.getByText("IDR Org")).toBeTruthy()

    expect(view.getByText("USD 125.00")).toBeTruthy()
    expect(view.getByText("USD 10.50")).toBeTruthy()
    expect(view.getByText("IDR 125.000,00")).toBeTruthy()
    expect(view.getByText("IDR 5.000,00")).toBeTruthy()

    // USD rows must not be labelled as IDR/Rp
    const html = view.container.innerHTML
    expect(html).not.toContain("Rp 125")
  })
})
