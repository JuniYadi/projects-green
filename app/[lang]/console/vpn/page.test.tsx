import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import type { VpnSubscription, VpnPackageSummary } from "@/lib/vpn-client"

const mockListVpnSubscriptions = mock(() => Promise.resolve([] as VpnSubscription[]))
const mockListVpnPackages = mock(() => Promise.resolve([] as VpnPackageSummary[]))

mock.module("@/lib/vpn-client", () => ({
  listVpnSubscriptions: mockListVpnSubscriptions,
  listVpnPackages: mockListVpnPackages,
  getVpnPackage: mock(() => Promise.resolve(null)),
  purchaseVpnPackage: mock(() => Promise.resolve({ id: "new-sub" })),
  cancelVpnSubscription: mock(() => Promise.resolve({ success: true })),
  getVpnProxyCredentials: mock(() => Promise.resolve(null)),
  vpnConfigDownloadUrl: (s: string, a: string) =>
    `/api/vpn/subscriptions/${s}/servers/${a}/config`,
}))

import ConsoleVpnDashboardPage from "./dashboard/page"

describe("ConsoleVpnDashboardPage", () => {
  it("shows available packages heading when no subscriptions exist", async () => {
    mockListVpnSubscriptions.mockResolvedValue([])

    const view = render(<ConsoleVpnDashboardPage />)

    await waitFor(() => {
      expect(view.getByText("VPN Packages")).toBeInTheDocument()
    })
    expect(view.getByText("Available packages")).toBeInTheDocument()
    expect(view.queryByText("My VPN Subscriptions")).not.toBeInTheDocument()
  })

  it("renders the My VPN Subscriptions section with server accounts", async () => {
    mockListVpnSubscriptions.mockResolvedValue([
      {
        id: "sub_1",
        organizationId: "org_1",
        packageId: "pkg_1",
        status: "ACTIVE",
        currentPeriodStart: "2026-06-01T00:00:00.000Z",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        priceLocked: "10.00",
        currency: "USD",
        originalPrice: null,
        originalCurrency: null,
        exchangeRate: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        serverAccounts: [
          {
            id: "sa_1",
            serverId: "srv_1",
            serverName: "ID-01",
            protocol: "OPENVPN",
            username: "vpn-org1-srv1-openvpn",
            provisioningStatus: "ACTIVE",
            failureReason: null,
            hasConfig: true,
            hasCredentials: false,
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    ])

    const view = render(<ConsoleVpnDashboardPage />)

    await waitFor(() => {
      expect(view.getByText("My VPN Subscriptions")).toBeInTheDocument()
    }, { timeout: 5000 })
    expect(view.getByText("ID-01")).toBeInTheDocument()
    expect(view.getByText("Add another package")).toBeInTheDocument()
  })
})
