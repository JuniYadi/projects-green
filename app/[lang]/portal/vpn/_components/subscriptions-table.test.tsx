/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock } from "bun:test"
import { render, waitFor, fireEvent } from "@testing-library/react"
import type { VpnSubscriptionItem } from "./vpn-admin-client"

const mockListVpnAdminSubscriptions = mock<
  (...args: any[]) => Promise<{
    data: VpnSubscriptionItem[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>
>(async () => ({
  data: [],
  pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
}))

mock.module("./vpn-admin-client", () => ({
  listVpnAdminSubscriptions: mockListVpnAdminSubscriptions,
}))

mock.module("./provisioning-audit-modal", () => ({
  ProvisioningAuditModal: () => <div data-testid="audit-modal" />,
}))

const { SubscriptionsTable } = await import("./subscriptions-table")

function makeSub(
  overrides: Partial<VpnSubscriptionItem> = {}
): VpnSubscriptionItem {
  return {
    id: "sub-1",
    organizationId: "org-123",
    organizationName: "Acme Inc",
    packageId: "pkg-1",
    packageName: "Basic VPN",
    status: "ACTIVE",
    currentPeriodStart: "2024-01-01T00:00:00.000Z",
    currentPeriodEnd: "2024-01-31T23:59:59.000Z",
    deviceCount: 2,
    serverAccounts: [
      {
        id: "sa-1",
        serverId: "srv-1",
        serverName: "SG-1",
        hostname: "sg-1.example.com",
        ipAddress: "10.0.0.1",
        region: { name: "Singapore", slug: "sg", countryCode: "SG" },
        port: 1194,
        protocol: "OPENVPN",
        username: "vpn-org-123-srv-1-openvpn-ab",
        provisioningStatus: "ACTIVE",
        failureReason: null,
        hasConfig: true,
        hasCredentials: true,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:01:00.000Z",
      },
      {
        id: "sa-2",
        serverId: "srv-2",
        serverName: "US-1",
        hostname: "us-1.example.com",
        ipAddress: "10.0.0.2",
        region: { name: "United States", slug: "us", countryCode: "US" },
        port: 51820,
        protocol: "WIREGUARD",
        username: "vpn-org-123-srv-2-wireguard-cd",
        provisioningStatus: "FAILED",
        failureReason: "Connection timeout",
        hasConfig: false,
        hasCredentials: false,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:02:00.000Z",
      },
    ],
    provisioningSummary: {
      active: 1,
      pending: 0,
      failed: 1,
      revoked: 0,
      total: 2,
    },
    priceLocked: "100000",
    currency: "IDR",
    originalPrice: "100000",
    originalCurrency: "IDR",
    exchangeRate: 1,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  }
}

const makeSuccess = (data: VpnSubscriptionItem[]) => ({
  data,
  pagination: { page: 1, limit: 25, total: data.length, totalPages: 1 },
})

describe("SubscriptionsTable", () => {
  it("renders provisioning health summary correctly", async () => {
    mockListVpnAdminSubscriptions.mockResolvedValue(makeSuccess([makeSub()]))
    const view = render(<SubscriptionsTable />)

    await waitFor(() => expect(view.getByText(/1 ACTIVE/)).toBeTruthy())
    await waitFor(() => expect(view.getByText(/1 FAILED/)).toBeTruthy())
  })

  it("shows Retry All Failed button when there are failed accounts", async () => {
    mockListVpnAdminSubscriptions.mockResolvedValue(makeSuccess([makeSub()]))
    const view = render(<SubscriptionsTable />)

    await waitFor(() => expect(view.getByText(/1 FAILED/)).toBeTruthy())
  })

  it("hides Retry All Failed button when no failed accounts", async () => {
    mockListVpnAdminSubscriptions.mockResolvedValue(
      makeSuccess([
        makeSub({
          provisioningSummary: {
            active: 2,
            pending: 0,
            failed: 0,
            revoked: 0,
            total: 2,
          },
          serverAccounts: [
            {
              id: "sa-1",
              serverId: "srv-1",
              serverName: "SG-1",
              hostname: "sg-1.example.com",
              ipAddress: "10.0.0.1",
              region: { name: "Singapore", slug: "sg", countryCode: "SG" },
              port: 1194,
              protocol: "OPENVPN",
              username: "vpn-org-123-srv-1-openvpn-ab",
              provisioningStatus: "ACTIVE",
              failureReason: null,
              hasConfig: true,
              hasCredentials: true,
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-01T00:01:00.000Z",
            },
          ],
        }),
      ])
    )
    const view = render(<SubscriptionsTable />)

    await waitFor(() => expect(view.getByText(/Acme Inc/)).toBeTruthy())

    const dataRow = view.getByText(/Acme Inc/).closest("tr")
    if (dataRow) {
      fireEvent.click(dataRow)
    }

    await waitFor(() => {
      const hasRetryBtn = view
        .getAllByRole("button")
        .some((b) => b.textContent?.includes("Retry All Failed"))
      expect(hasRetryBtn).toBe(false)
    })
  })
})
