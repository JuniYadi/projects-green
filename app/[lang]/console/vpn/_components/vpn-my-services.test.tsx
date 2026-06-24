import { describe, expect, it, mock } from "bun:test"
import { act, render } from "@testing-library/react"

import { VpnMyServices } from "./vpn-my-services"
import type { VpnSubscription } from "@/lib/vpn-client"

// ponytail: mock leaf dependencies (HTTP fetch), not services
mock.module("@/lib/vpn-mobile-client", () => ({
  listMobileDevices: mock(async () => []),
}))

function renderAsync(ui: React.ReactElement) {
  const view = render(ui)
  // Flush useEffect that loads devices
  act(() => {})
  return view
}

const subscription = (
  overrides: Partial<VpnSubscription> = {},
): VpnSubscription => ({
  id: "sub-1",
  organizationId: "org-1",
  packageId: "pkg-1",
  packageName: "Pro VPN - SG Standard",
  status: "ACTIVE",
  currentPeriodStart: "2026-06-01T00:00:00.000Z",
  currentPeriodEnd: "2026-07-01T00:00:00.000Z",
  priceLocked: "150000",
  currency: "IDR",
  originalPrice: "150000",
  originalCurrency: "IDR",
  exchangeRate: null,
  deviceCount: 0,
  provisioningSummary: { active: 2, pending: 0, failed: 0, revoked: 0, total: 2 },
  cancelAtPeriodEnd: false,
  serverAccounts: [
    {
      id: "sa-1",
      serverId: "srv-1",
      serverName: "SG01",
      protocol: "OPENVPN",
      username: "org-test-abc",
      provisioningStatus: "ACTIVE",
      failureReason: null,
      hasConfig: true,
      hasCredentials: false,
      hostname: "sg01.vpn.com",
      ipAddress: "203.0.113.10",
      region: { name: "Singapore", slug: "singapore", countryCode: "SG" },
      port: 1194,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "sa-2",
      serverId: "srv-1",
      serverName: "SG01",
      protocol: "WIREGUARD",
      username: "org-test-def",
      provisioningStatus: "FAILED",
      failureReason: "SSH key mismatch on server",
      hasConfig: false,
      hasCredentials: false,
      hostname: "sg01.vpn.com",
      ipAddress: "203.0.113.10",
      region: { name: "Singapore", slug: "singapore", countryCode: "SG" },
      port: 51820,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
})

describe("VpnMyServices", () => {
  it("renders subscription card with package name and status", () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )

    expect(view.getByText("Pro VPN - SG Standard")).toBeInTheDocument()
    const badges = view.getAllByText("ACTIVE")
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it("groups server accounts by serverId", () => {
    const multiServer: VpnSubscription = {
      ...subscription(),
      serverAccounts: [
        {
          id: "sa-1",
          serverId: "srv-1",
          serverName: "SG01",
          protocol: "OPENVPN",
          username: "u1",
          provisioningStatus: "ACTIVE",
          failureReason: null,
          hasConfig: true,
          hasCredentials: false,
          hostname: "sg01.vpn.com",
          ipAddress: "203.0.113.10",
          region: { name: "Singapore", slug: "singapore", countryCode: "SG" },
          port: 1194,
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
        {
          id: "sa-2",
          serverId: "srv-2",
          serverName: "US01",
          protocol: "WIREGUARD",
          username: "u2",
          provisioningStatus: "ACTIVE",
          failureReason: null,
          hasConfig: true,
          hasCredentials: false,
          hostname: "us01.vpn.com",
          ipAddress: "198.51.100.20",
          region: { name: "US West", slug: "us-west", countryCode: "US" },
          port: 51820,
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    }

    const view = renderAsync(
      <VpnMyServices subscriptions={[multiServer]} onChanged={() => {}} />,
    )

    expect(view.getByText("SG01")).toBeInTheDocument()
    expect(view.getByText("US01")).toBeInTheDocument()
    expect(view.getByText(/sg01\.vpn\.com/)).toBeInTheDocument()
    expect(view.getByText(/us01\.vpn\.com/)).toBeInTheDocument()
  })

  it("shows protocol labels for each account", () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )

    expect(view.getByText("OVPN")).toBeInTheDocument()
    expect(view.getByText("WG")).toBeInTheDocument()
  })

  it("shows port numbers per protocol", () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )

    expect(view.getByText(":1194")).toBeInTheDocument()
    expect(view.getByText(":51820")).toBeInTheDocument()
  })

  it("shows failure reason for FAILED protocols", () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )

    expect(view.getByText("SSH key mismatch on server")).toBeInTheDocument()
  })

  it("shows region name", () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )

    expect(view.getByText("Singapore")).toBeInTheDocument()
  })

  it("renders empty when no subscriptions", () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[]} onChanged={() => {}} />,
    )

    expect(view.container.textContent).toBe("")
  })

  it("shows cancel button for ACTIVE subscription", () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )

    expect(view.getByText("Cancel")).toBeInTheDocument()
  })

  it("shows Reinstate when cancelAtPeriodEnd is true", () => {
    const view = renderAsync(
      <VpnMyServices
        subscriptions={[subscription({ cancelAtPeriodEnd: true })]}
        onChanged={() => {}}
      />,
    )

    expect(view.getByText("Reinstate")).toBeInTheDocument()
  })

  it("disables cancel button for non-ACTIVE subscriptions", () => {
    const view = renderAsync(
      <VpnMyServices
        subscriptions={[subscription({ status: "SUSPENDED" })]}
        onChanged={() => {}}
      />,
    )

    const btn = view.getByText("Cancel").closest("button")
    expect(btn?.disabled).toBe(true)
  })

  it("shows — for missing hostname/IP", () => {
    const noHostSub = subscription()
    noHostSub.serverAccounts = [
      {
        ...noHostSub.serverAccounts[0],
        hostname: "",
        ipAddress: null,
      },
    ]

    const view = renderAsync(
      <VpnMyServices subscriptions={[noHostSub]} onChanged={() => {}} />,
    )

    expect(view.getByText(/—/)).toBeInTheDocument()
  })
})
