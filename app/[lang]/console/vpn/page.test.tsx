import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import type { VpnPackageSummary, VpnSubscription } from "@/lib/vpn-client"
import type { MobileDeviceEntry } from "@/lib/vpn-mobile-client"

const mockListVpnSubscriptions = mock(() =>
  Promise.resolve([] as VpnSubscription[])
)
const mockListVpnPackages = mock(() =>
  Promise.resolve([] as VpnPackageSummary[])
)
const mockListMobileDevices = mock(() =>
  Promise.resolve([] as MobileDeviceEntry[])
)

mock.module("@/lib/vpn-client", () => ({
  listVpnSubscriptions: mockListVpnSubscriptions,
  listVpnPackages: mockListVpnPackages,
  getVpnPackage: mock(() => Promise.resolve(null)),
  purchaseVpnPackage: mock(() => Promise.resolve({ id: "new-sub" })),
  getVpnProxyCredentials: mock(() => Promise.resolve(null)),
  vpnConfigDownloadUrl: (s: string, a: string) =>
    `/api/vpn/subscriptions/${s}/servers/${a}/config`,
}))

mock.module("@/lib/vpn-mobile-client", () => ({
  listMobileDevices: mockListMobileDevices,
}))

import ConsoleVpnDashboardPage from "./dashboard/page"
import ConsoleVpnOrderPage from "./order/page"

import ConsoleVpnSubscriptionsPage from "./subscriptions/page"

describe("ConsoleVpnSubscriptionsPage", () => {
  beforeEach(() => {
    mockListVpnSubscriptions.mockResolvedValue([])
    mockListVpnPackages.mockResolvedValue([])
    mockListMobileDevices.mockRejectedValue(new Error("devices unavailable"))
    localStorage.clear()
  })

  it("renders subscriptions as a table with server details on demand", async () => {
    mockListVpnSubscriptions.mockResolvedValue([
      {
        id: "sub_1",
        organizationId: "org_1",
        packageId: "pkg_1",
        packageName: "VPN Standard",
        status: "ACTIVE",
        currentPeriodStart: "2026-06-01T00:00:00.000Z",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        priceLocked: "10.00",
        currency: "USD",
        originalPrice: null,
        originalCurrency: null,
        exchangeRate: null,
        cancelAtPeriodEnd: false,
        deviceCount: 0,
        provisioningSummary: {
          active: 2,
          pending: 0,
          failed: 0,
          revoked: 0,
          total: 2,
        },
        firstPayment: null,
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
            hostname: "id01.vpn.com",
            ipAddress: "203.0.113.1",
            region: {
              name: "Indonesia",
              slug: "indonesia",
              countryCode: "ID",
            },
            port: 1194,
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
          {
            id: "sa_2",
            serverId: "srv_2",
            serverName: "SG-01",
            protocol: "WIREGUARD",
            username: "vpn-org1-srv2-wireguard",
            provisioningStatus: "ACTIVE",
            failureReason: null,
            hasConfig: true,
            hasCredentials: false,
            hostname: "sg01.vpn.com",
            ipAddress: "203.0.113.2",
            region: {
              name: "Singapore",
              slug: "singapore",
              countryCode: "SG",
            },
            port: 51820,
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    ])

    const view = render(<ConsoleVpnSubscriptionsPage />)

    await waitFor(
      () => {
        expect(view.getByText("My VPN Subscriptions")).toBeInTheDocument()
      },
      { timeout: 10000 },
    )

    expect(view.getByPlaceholderText("Search subscriptions...")).toBeInTheDocument()
    expect(view.getByRole("button", { name: /columns/i })).toBeInTheDocument()
    expect(view.getByText("VPN Standard")).toBeInTheDocument()
    expect(view.getByText("2 servers · 2 accounts")).toBeInTheDocument()
    expect(
      view.getByRole("link", { name: "View details" }),
    ).toHaveAttribute("href", "/console/vpn/subscriptions/sub_1")
  })
})
describe("ConsoleVpnDashboardPage", () => {
  beforeEach(() => {
    mockListVpnSubscriptions.mockResolvedValue([])
    mockListVpnPackages.mockResolvedValue([])
    mockListMobileDevices.mockResolvedValue([])
  })

  it("points empty users to the dedicated order page", async () => {
    const view = render(<ConsoleVpnDashboardPage />)

    await waitFor(
      () => {
        expect(view.getByText("VPN Dashboard")).toBeInTheDocument()
      },
      { timeout: 10000 }
    )

    const orderLink = view.getByRole("link", {
      name: /choose a vpn package/i,
    })
    expect(orderLink).toHaveAttribute("href", "/en/console/vpn/order")
    expect(view.queryByText("Available Packages")).not.toBeInTheDocument()
    expect(view.queryByText("My VPN Subscriptions")).not.toBeInTheDocument()
  })

  it("renders service overview without duplicating subscription cards", async () => {
    mockListVpnSubscriptions.mockResolvedValue([
      {
        id: "sub_1",
        organizationId: "org_1",
        packageId: "pkg_1",
        packageName: "VPN Standard",
        status: "ACTIVE",
        currentPeriodStart: "2026-06-01T00:00:00.000Z",
        currentPeriodEnd: "2026-07-01T00:00:00.000Z",
        priceLocked: "10.00",
        currency: "USD",
        originalPrice: null,
        originalCurrency: null,
        exchangeRate: null,
        cancelAtPeriodEnd: false,
        deviceCount: 0,
        provisioningSummary: {
          active: 1,
          pending: 0,
          failed: 0,
          revoked: 0,
          total: 1,
        },
        firstPayment: null,
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
            hostname: "id01.vpn.com",
            ipAddress: "203.0.113.1",
            region: {
              name: "Indonesia",
              slug: "indonesia",
              countryCode: "ID",
            },
            port: 1194,
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    ])

    const view = render(<ConsoleVpnDashboardPage />)

    await waitFor(
      () => {
        expect(view.getByText("Service Readiness")).toBeInTheDocument()
      },
      { timeout: 10000 }
    )

    expect(view.getByText("Ready Accounts")).toBeInTheDocument()
    expect(view.getByText("1 / 1")).toBeInTheDocument()
    expect(view.getByText("Region Coverage")).toBeInTheDocument()
    expect(view.getByText("Indonesia")).toBeInTheDocument()
    expect(view.queryByText("Recommended Packages")).not.toBeInTheDocument()
    expect(view.queryByText("Order Package")).not.toBeInTheDocument()
    expect(view.queryByText("My VPN Subscriptions")).not.toBeInTheDocument()
    expect(view.queryByText("ID-01")).not.toBeInTheDocument()
  })
})

describe("ConsoleVpnOrderPage", () => {
  beforeEach(() => {
    mockListVpnSubscriptions.mockResolvedValue([])
    mockListVpnPackages.mockResolvedValue([])
    mockListMobileDevices.mockResolvedValue([])
  })

  it("renders package cards with comparison", async () => {
    mockListVpnPackages.mockResolvedValue([
      {
        id: "pkg_1",
        name: "Starter Indonesia",
        description: "Good for first VPN setup.",
        price: "100000",
        currency: "IDR",
        serverCount: 2,
        protocolCount: 2,
        regions: ["Indonesia"],
        convertedPrice: null,
        convertedCurrency: null,
        exchangeRate: null,
      },
      {
        id: "pkg_2",
        name: "Premium Asia",
        description: "More coverage across Asia.",
        price: "250000",
        currency: "IDR",
        serverCount: 6,
        protocolCount: 3,
        regions: ["Indonesia", "Singapore", "Japan"],
        convertedPrice: null,
        convertedCurrency: null,
        exchangeRate: null,
      },
    ])

    const view = render(<ConsoleVpnOrderPage />)

    await waitFor(
      () => {
        expect(view.getByText("Order VPN Package")).toBeInTheDocument()
      },
      { timeout: 10000 }
    )

    expect(view.getByText("Recommended for You")).toBeInTheDocument()
    expect(view.getByText("Protocol Benefits")).toBeInTheDocument()
    expect(view.getByText("WireGuard")).toBeInTheDocument()
    expect(view.getByText("OpenVPN")).toBeInTheDocument()
    expect(view.getByText("Proxy")).toBeInTheDocument()
    expect(view.getByText("Compare Packages")).toBeInTheDocument()
    expect(view.getAllByText("Starter Indonesia").length).toBeGreaterThan(0)
    expect(view.getAllByText("Premium Asia").length).toBeGreaterThan(0)
    expect(view.getAllByText("Most coverage").length).toBeGreaterThan(0)
  })
})
