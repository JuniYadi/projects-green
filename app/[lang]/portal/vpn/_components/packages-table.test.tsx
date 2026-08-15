import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"

import type { VpnPackageItem } from "./vpn-admin-client"

const mockListVpnPackages = mock(async () => ({ data: [] as VpnPackageItem[] }))
const mockListVpnServers = mock(async () => ({ data: [] }))
const mockDeleteVpnPackage = mock(async () => undefined)

mock.module("next/navigation", () => ({
  useParams: () => ({ lang: "en" }),
}))

mock.module("./vpn-admin-client", () => ({
  listVpnPackages: mockListVpnPackages,
  listVpnServers: mockListVpnServers,
  deleteVpnPackage: mockDeleteVpnPackage,
}))

mock.module("./package-form", () => ({
  PackageForm: () => null,
}))

const { PackagesTable } = await import("./packages-table")

function makePackage(overrides: Partial<VpnPackageItem> = {}): VpnPackageItem {
  return {
    id: "package-1",
    servicePlanId: "plan-1",
    name: "Business VPN",
    description: "For teams",
    price: null,
    currency: null,
    isActive: true,
    serverCount: 1,
    servers: [],
    catalogPlan: {
      id: "plan-1",
      code: "VPN_PACKAGE_ONE",
      name: "Business VPN plan",
      packageCode: "VPN",
      isActive: true,
    },
    offers: [
      {
        id: "offer-1",
        billingPeriod: "MONTHLY",
        periodMonths: 1,
        periodPrice: "100000",
        currency: "IDR",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        effectiveTo: null,
      },
    ],
    pricingStatus: "READY",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("PackagesTable", () => {
  beforeEach(() => {
    mockListVpnPackages.mockClear()
    mockListVpnServers.mockClear()
    mockDeleteVpnPackage.mockClear()
    mockListVpnPackages.mockResolvedValue({ data: [] })
    mockListVpnServers.mockResolvedValue({ data: [] })
  })

  it("shows the linked plan, current offer, and plan-scoped pricing link", async () => {
    mockListVpnPackages.mockResolvedValue({ data: [makePackage()] })

    const view = render(<PackagesTable />)

    await waitFor(() =>
      expect(view.getByText("Business VPN plan")).toBeTruthy()
    )
    expect(view.getByText(/IDR/)).toBeTruthy()

    const link = view.getByRole("link", {
      name: "Manage pricing for Business VPN",
    })
    expect(link).toHaveAttribute(
      "href",
      "/en/portal/billing/catalog/products/vpn?plan=plan-1&tab=plans&returnTo=%2Fen%2Fportal%2Fvpn%2Fpackages"
    )
  })

  it("shows pricing required when no current offer is published", async () => {
    mockListVpnPackages.mockResolvedValue({
      data: [makePackage({ offers: [], pricingStatus: "PRICING_REQUIRED" })],
    })

    const view = render(<PackagesTable />)

    expect(await view.findByText("Pricing required")).toBeTruthy()
  })
})
