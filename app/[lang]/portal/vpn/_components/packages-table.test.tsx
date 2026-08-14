import { describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
}))

const listVpnPackages = mock()
const listVpnServers = mock()
mock.module("./vpn-admin-client", () => ({
  listVpnPackages,
  listVpnServers,
  deleteVpnPackage: mock(),
  createVpnPackage: mock(),
  updateVpnPackage: mock(),
}))

const { PackagesTable } = await import("./packages-table")

function packageRecord(
  id: string,
  catalogPlan: {
    id: string
    code: string
    name: string
    isActive: boolean
    parentIsActive: boolean
    offers: Array<{
      id: string
      billingPeriod: "MONTHLY"
      periodMonths: 1
      periodPrice: string
      currency: string
      effectiveFrom: string
      effectiveTo: string | null
      isActive: boolean
    }>
  } | null
) {
  return {
    id,
    servicePlanId: catalogPlan?.id ?? `plan-${id}`,
    name: id,
    description: null,
    price: null,
    currency: null,
    isActive: true,
    catalogPlan,
    pricingStatus: catalogPlan?.offers.length ? "READY" : "PRICING_REQUIRED",
    catalogAvailable: Boolean(catalogPlan?.offers.length),
    serverCount: 0,
    servers: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

describe("PackagesTable catalog pricing handoff", () => {
  it("links each package to its selected plan and explains missing pricing", async () => {
    listVpnPackages.mockResolvedValue({
      data: [
        packageRecord("Ready", {
          id: "plan-ready",
          code: "VPN_PACKAGE_READY",
          name: "Ready plan",
          isActive: true,
          parentIsActive: true,
          offers: [
            {
              id: "offer-ready",
              billingPeriod: "MONTHLY",
              periodMonths: 1,
              periodPrice: "100000",
              currency: "IDR",
              effectiveFrom: "2026-01-01T00:00:00.000Z",
              effectiveTo: null,
              isActive: true,
            },
          ],
        }),
        packageRecord("Unpriced", null),
      ],
    })
    listVpnServers.mockResolvedValue({ data: [] })

    const view = render(<PackagesTable />)

    await waitFor(() => expect(view.getByText("Ready plan")).toBeTruthy())
    expect(view.getByText("IDR 100000 / monthly")).toBeTruthy()
    expect(view.getAllByText("Pricing required").length).toBeGreaterThan(0)

    const pricingLinks = view.getAllByRole("link", { name: "Manage pricing" })
    expect(pricingLinks[0]).toHaveAttribute(
      "href",
      expect.stringContaining("/en/portal/billing/catalog/products/vpn")
    )
    expect(pricingLinks[0].getAttribute("href")).toContain("planId=plan-ready")
    expect(pricingLinks[0].getAttribute("href")).toContain("tab=plans")
    expect(pricingLinks[0].getAttribute("href")).toContain("returnTo=")
  })
})
