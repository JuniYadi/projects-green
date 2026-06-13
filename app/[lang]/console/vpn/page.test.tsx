import { describe, expect, it, mock, beforeEach } from "bun:test"
import { render, waitFor } from "@testing-library/react"

const mockListVpnSubscriptions = mock()
const mockListVpnPackages = mock()

mock.module("@/lib/vpn-client", () => ({
  listVpnSubscriptions: mockListVpnSubscriptions,
  listVpnPackages: mockListVpnPackages,
  getVpnPackage: mock(),
  purchaseVpnPackage: mock(),
  cancelVpnSubscription: mock(),
  getVpnProxyCredentials: mock(),
  vpnConfigDownloadUrl: (s: string, a: string) =>
    `/api/vpn/subscriptions/${s}/servers/${a}/config`,
}))

import ConsoleVpnPage from "./page"

beforeEach(() => {
  mockListVpnSubscriptions.mockReset()
  mockListVpnPackages.mockReset()
  mockListVpnPackages.mockResolvedValue([])
})

describe("ConsoleVpnPage", () => {
  it("shows available packages heading when no subscriptions exist", async () => {
    mockListVpnSubscriptions.mockResolvedValue([])

    const view = render(<ConsoleVpnPage />)

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

    const view = render(<ConsoleVpnPage />)

    await waitFor(() => {
      expect(view.getByText("My VPN Subscriptions")).toBeInTheDocument()
    })
    expect(view.getByText("ID-01")).toBeInTheDocument()
    expect(view.getByText("Add another package")).toBeInTheDocument()
  })
})
