import { beforeEach, describe, expect, it, mock } from "bun:test"
import { render, waitFor } from "@testing-library/react"
import { useParams } from "next/navigation"
import type { VpnSubscriptionItem } from "../../_components/vpn-admin-client"

const mockGetVpnAdminSubscription = mock()

mock.module("../../_components/vpn-admin-client", () => ({
  getVpnAdminSubscription: mockGetVpnAdminSubscription,
  retryVpnServerAccount: mock(),
  revokeVpnServerAccount: mock(),
  retryAllVpnServerAccounts: mock(),
  validateVpnServerAccount: mock(),
  recreateVpnServerAccount: mock(),
  vpnAdminConfigDownloadUrl: mock(() => ""),
}))

mock.module("../../_components/provisioning-audit-modal", () => ({
  ProvisioningAuditModal: () => null,
}))

mock.module("@/modules/vpn/_components/vpn-pairing-qr-modal", () => ({
  VpnPairingQrModal: () => null,
}))

const { default: SubscriptionDetailPage } = await import("./page")

const baseSubscription: VpnSubscriptionItem = {
  id: "vpn-1",
  organizationId: "org-1",
  organizationName: "Acme Inc",
  packageId: "pkg-1",
  packageName: "Basic VPN",
  serviceSubscriptionId: "service-sub-1",
  status: "ACTIVE",
  currentPeriodStart: "2026-06-01T00:00:00.000Z",
  currentPeriodEnd: "2026-07-01T00:00:00.000Z",
  deviceCount: 0,
  serverAccounts: [],
  provisioningSummary: {
    active: 0,
    pending: 0,
    failed: 0,
    revoked: 0,
    total: 0,
  },
  priceLocked: "100000",
  currency: "IDR",
  originalPrice: null,
  originalCurrency: null,
  exchangeRate: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
}

beforeEach(() => {
  mockGetVpnAdminSubscription.mockReset()
  ;(useParams as ReturnType<typeof mock>).mockReturnValue({ id: "vpn-1" })
})

describe("VPN service operation detail", () => {
  it("links a related commercial subscription to Billing", async () => {
    mockGetVpnAdminSubscription.mockResolvedValue({
      data: baseSubscription,
    })

    const view = render(<SubscriptionDetailPage />)

    await waitFor(() =>
      expect(view.getByText("Commercial Subscription Context")).toBeTruthy()
    )
    expect(
      view.getByRole("link", { name: "View in Billing" }).getAttribute("href")
    ).toBe("/portal/billing/subscriptions?subscriptionId=service-sub-1")
  })

  it("shows the missing-relation state for a legacy record", async () => {
    mockGetVpnAdminSubscription.mockResolvedValue({
      data: { ...baseSubscription, serviceSubscriptionId: null },
    })

    const view = render(<SubscriptionDetailPage />)

    await waitFor(() =>
      expect(view.getByText("Unavailable (legacy record)")).toBeTruthy()
    )
    expect(view.queryByRole("link", { name: "View in Billing" })).toBeNull()
  })
})
