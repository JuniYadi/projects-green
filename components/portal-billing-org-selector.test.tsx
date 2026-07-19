import { describe, it, expect, mock, beforeEach } from "bun:test"

// ── Mock billing-client (next/navigation is already mocked in test/setup) ──
const mockGetAdminOrgs = mock(
  (): Promise<{ orgs: Array<{ orgId: string; orgName: string }> }> =>
    Promise.resolve({ orgs: [] })
)

mock.module("@/lib/billing-client", () => ({
  getAdminOrgs: mockGetAdminOrgs,
}))

// ── Dynamic imports after mocks ─────────────────────────────────────────
const { render, waitFor } = await import("@testing-library/react")
const { default: userEvent } = await import("@testing-library/user-event")
const nav = await import("next/navigation")
const { PortalBillingOrgSelector } =
  await import("./portal-billing-org-selector")

describe("PortalBillingOrgSelector", () => {
  beforeEach(() => {
    ;(nav.usePathname as ReturnType<typeof mock>).mockReturnValue(
      "/en/portal/billing/org/org-1"
    )
    ;(nav.useSearchParams as ReturnType<typeof mock>).mockReturnValue(
      new URLSearchParams("tab=invoices")
    )
  })

  it("shows loading state initially", () => {
    mockGetAdminOrgs.mockReturnValue(new Promise(() => {}))
    const view = render(<PortalBillingOrgSelector />)
    expect(view.getByText("Loading orgs...")).toBeDefined()
  })

  it("shows empty state when no orgs returned", async () => {
    mockGetAdminOrgs.mockResolvedValue({ orgs: [] })
    const view = render(<PortalBillingOrgSelector />)
    await waitFor(() => {
      expect(view.getByText("No organizations")).toBeDefined()
    })
  })

  it("renders org options from API", async () => {
    mockGetAdminOrgs.mockResolvedValue({
      orgs: [
        { orgId: "org-1", orgName: "Acme Corp" },
        { orgId: "org-2", orgName: "Beta Inc" },
      ],
    })
    const view = render(<PortalBillingOrgSelector />)

    await waitFor(() => {
      expect(view.getByText("Acme Corp")).toBeDefined()
    })
  })

  it("navigates to selected org preserving tab param", async () => {
    const router = (nav.useRouter as ReturnType<typeof mock>)()
    mockGetAdminOrgs.mockResolvedValue({
      orgs: [
        { orgId: "org-1", orgName: "Acme Corp" },
        { orgId: "org-2", orgName: "Beta Inc" },
      ],
    })
    const user = userEvent.setup()
    const view = render(<PortalBillingOrgSelector />)

    await waitFor(() => {
      expect(view.getByText("Acme Corp")).toBeDefined()
    })

    const trigger = view.getByRole("combobox")
    await user.click(trigger)

    const option = view.getByText("Beta Inc")
    await user.click(option)

    expect(router.push).toHaveBeenCalledWith(
      "/en/portal/orgs/org-2?page=invoices"
    )
  })
})
