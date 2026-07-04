import { beforeEach, describe, expect, it, mock } from "bun:test"
import { act, render, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { VpnMyServices } from "./vpn-my-services"
import type { VpnServerAccount, VpnSubscription } from "@/lib/vpn-client"

// ponytail: mock leaf dependencies (HTTP fetch), not services
mock.module("@/lib/vpn-mobile-client", () => ({
  listMobileDevices: mock(async () => {
    throw new Error("devices unavailable")
  }),
}))

function renderAsync(ui: React.ReactElement) {
  const view = render(ui)
  // Flush useEffect that loads devices
  act(() => {})
  return view
}

const serverAccount = (
  overrides: Partial<VpnServerAccount> = {},
): VpnServerAccount => ({
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
  ...overrides,
})

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
    serverAccount(),
    serverAccount({
      id: "sa-2",
      protocol: "WIREGUARD",
      username: "org-test-def",
      provisioningStatus: "FAILED",
      failureReason: "SSH key mismatch on server",
      hasConfig: false,
      port: 51820,
    }),
  ],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
})

function manyServerSubscription(count: number): VpnSubscription {
  return subscription({
    serverAccounts: Array.from({ length: count }, (_, index) => {
      const number = String(index + 1).padStart(2, "0")
      return serverAccount({
        id: `sa-${number}`,
        serverId: `srv-${number}`,
        serverName: `SG${number}`,
        username: `org-test-${number}`,
        hostname: `sg${number}.vpn.com`,
        ipAddress: `203.0.113.${index + 1}`,
      })
    }),
    provisioningSummary: {
      active: count,
      pending: 0,
      failed: 0,
      revoked: 0,
      total: count,
    },
  })
}

beforeEach(() => {
  localStorage.clear()
})

describe("VpnMyServices", () => {
  it("renders subscription table with package name and status", () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )

    expect(view.getByText("Pro VPN - SG Standard")).toBeInTheDocument()
    const badges = view.getAllByText("ACTIVE")
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it("keeps many servers collapsed until subscription details opens", async () => {
    const view = renderAsync(
      <VpnMyServices
        subscriptions={[manyServerSubscription(10)]}
        onChanged={() => {}}
      />,
    )

    expect(within(view.container).getAllByRole("row").length).toBe(2)
    expect(view.getByText("Pro VPN - SG Standard")).toBeInTheDocument()
    expect(view.getByText("10 servers · 10 accounts")).toBeInTheDocument()
    expect(view.queryByText("SG01")).toBeNull()

    act(() => {
      view.getByRole("button", { name: "View details" }).click()
    })

    const dialog = view.getByRole("dialog")
    expect(within(dialog).getByText("SG01")).toBeInTheDocument()
    expect(within(dialog).getByText(/sg01\.vpn\.com/)).toBeInTheDocument()
    expect(within(dialog).getAllByText("OVPN").length).toBeGreaterThan(0)
    expect(within(dialog).getAllByText(":1194").length).toBeGreaterThan(0)
  })

  it("groups server accounts by serverId inside subscription details", async () => {
    const multiServer = subscription({
      serverAccounts: [
        serverAccount(),
        serverAccount({
          id: "sa-2",
          serverId: "srv-2",
          serverName: "US01",
          protocol: "WIREGUARD",
          username: "u2",
          hostname: "us01.vpn.com",
          ipAddress: "198.51.100.20",
          region: { name: "US West", slug: "us-west", countryCode: "US" },
          port: 51820,
        }),
      ],
    })

    const view = renderAsync(
      <VpnMyServices subscriptions={[multiServer]} onChanged={() => {}} />,
    )
    act(() => {
      view.getByRole("button", { name: "View details" }).click()
    })

    const dialog = view.getByRole("dialog")
    expect(within(dialog).getByText("SG01")).toBeInTheDocument()
    expect(within(dialog).getByText("US01")).toBeInTheDocument()
    expect(within(dialog).getByText(/sg01\.vpn\.com/)).toBeInTheDocument()
    expect(within(dialog).getByText(/us01\.vpn\.com/)).toBeInTheDocument()
  })

  it("shows protocol labels for each account inside subscription details", async () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )
    act(() => {
      view.getByRole("button", { name: "View details" }).click()
    })

    const dialog = view.getByRole("dialog")
    expect(within(dialog).getByText("OVPN")).toBeInTheDocument()
    expect(within(dialog).getByText("WG")).toBeInTheDocument()
  })

  it("shows port numbers per protocol inside subscription details", async () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )
    act(() => {
      view.getByRole("button", { name: "View details" }).click()
    })

    const dialog = view.getByRole("dialog")
    expect(within(dialog).getByText(":1194")).toBeInTheDocument()
    expect(within(dialog).getByText(":51820")).toBeInTheDocument()
  })

  it("shows failure reason for FAILED protocols inside subscription details", async () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )
    act(() => {
      view.getByRole("button", { name: "View details" }).click()
    })

    const dialog = view.getByRole("dialog")
    expect(
      within(dialog).getByText("SSH key mismatch on server"),
    ).toBeInTheDocument()
  })

  it("shows region name in the table summary", () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )

    expect(view.getAllByText("Singapore").length).toBeGreaterThan(0)
  })

  it("shows cancel in the actions menu for ACTIVE subscription", async () => {
    const view = renderAsync(
      <VpnMyServices subscriptions={[subscription()]} onChanged={() => {}} />,
    )

    await userEvent.click(view.getByRole("button", { name: "Actions" }))
    expect(view.getByRole("menuitem", { name: "Cancel" })).toBeInTheDocument()
  })

  it("shows Reinstate in the actions menu when cancelAtPeriodEnd is true", async () => {
    const view = renderAsync(
      <VpnMyServices
        subscriptions={[subscription({ cancelAtPeriodEnd: true })]}
        onChanged={() => {}}
      />,
    )

    await userEvent.click(view.getByRole("button", { name: "Actions" }))
    expect(view.getByRole("menuitem", { name: "Reinstate" })).toBeInTheDocument()
  })

  it("disables cancel menu item for non-ACTIVE subscriptions", async () => {
    const view = renderAsync(
      <VpnMyServices
        subscriptions={[subscription({ status: "SUSPENDED" })]}
        onChanged={() => {}}
      />,
    )

    await userEvent.click(view.getByRole("button", { name: "Actions" }))
    expect(view.getByRole("menuitem", { name: "Cancel" })).toHaveAttribute(
      "aria-disabled",
      "true",
    )
  })

  it("shows — for missing hostname/IP inside subscription details", async () => {
    const noHostSub = subscription({
      serverAccounts: [
        serverAccount({
          hostname: "",
          ipAddress: null,
        }),
      ],
    })

    const view = renderAsync(
      <VpnMyServices subscriptions={[noHostSub]} onChanged={() => {}} />,
    )
    act(() => {
      view.getByRole("button", { name: "View details" }).click()
    })

    const dialog = view.getByRole("dialog")
    expect(within(dialog).getByText(/—/)).toBeInTheDocument()
  })

  it("filters subscription rows by global search", async () => {
    const view = renderAsync(
      <VpnMyServices
        subscriptions={[
          subscription({ id: "sub-sg", packageName: "Pro VPN - SG Standard" }),
          subscription({
            id: "sub-us",
            packageName: "Enterprise VPN - US",
            serverAccounts: [
              serverAccount({
                id: "sa-us",
                serverId: "srv-us",
                serverName: "US01",
                hostname: "us01.vpn.com",
                region: { name: "US West", slug: "us-west", countryCode: "US" },
              }),
            ],
          }),
        ]}
        onChanged={() => {}}
      />,
    )

    await userEvent.type(
      view.getByPlaceholderText("Search subscriptions..."),
      "Enterprise",
    )

    await waitFor(() => {
      expect(within(view.container).getAllByRole("row").length).toBe(2)
      expect(view.getByText("Enterprise VPN - US")).toBeInTheDocument()
      expect(view.queryByText("Pro VPN - SG Standard")).toBeNull()
    })
  })

  it("filters subscription rows by region facet", async () => {
    const view = renderAsync(
      <VpnMyServices
        subscriptions={[
          subscription({ id: "sub-sg", packageName: "Pro VPN - SG Standard" }),
          subscription({
            id: "sub-us",
            packageName: "Enterprise VPN - US",
            serverAccounts: [
              serverAccount({
                id: "sa-us",
                serverId: "srv-us",
                serverName: "US01",
                hostname: "us01.vpn.com",
                region: { name: "US West", slug: "us-west", countryCode: "US" },
              }),
            ],
          }),
        ]}
        onChanged={() => {}}
      />,
    )

    const regionSelect = within(view.container).getAllByRole("combobox")[1]
    await userEvent.click(regionSelect)
    await userEvent.click(view.getByRole("option", { name: "Singapore (SG)" }))

    await waitFor(() => {
      expect(within(view.container).getAllByRole("row").length).toBe(2)
      expect(view.getByText("Pro VPN - SG Standard")).toBeInTheDocument()
      expect(view.queryByText("Enterprise VPN - US")).toBeNull()
    })
  })
})
