import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PrismaClient } from "@prisma/client"

const mockVpnSubFindFirst = mock()
const mockVpnSubUpdate = mock()
const mockDeviceUpdateMany = mock()
const mockRemoveRemoteAccount = mock()
const mockSendSuspended = mock()
const mockSendExpired = mock()

const mockEmailService = {
  sendSubscriptionSuspended: mockSendSuspended,
  sendSubscriptionExpired: mockSendExpired,
}

const mockPrismaClient = {
  vpnSubscription: {
    findFirst: mockVpnSubFindFirst,
    update: mockVpnSubUpdate,
  },
  vpnMobileDevice: { updateMany: mockDeviceUpdateMany },
}

mock.module("@/modules/vpn/provisioning/vpn-provisioning.service", () => ({
  vpnProvisioningService: { removeRemoteAccount: mockRemoveRemoteAccount },
}))

import { createVpnRenewalCallbacks } from "./vpn-renewal-callbacks"

describe("createVpnRenewalCallbacks", () => {
  let callbacks: ReturnType<typeof createVpnRenewalCallbacks>

  beforeEach(() => {
    mock.clearAllMocks()
    mockVpnSubFindFirst.mockResolvedValue({
      id: "vpn-sub-1",
      organizationId: "org-1",
      serverAccounts: [{ id: "account-1" }],
    })
    mockVpnSubUpdate.mockResolvedValue({ id: "vpn-sub-1" })
    mockDeviceUpdateMany.mockResolvedValue({ count: 2 })
    mockRemoveRemoteAccount.mockResolvedValue(undefined)
    mockSendSuspended.mockResolvedValue(undefined)
    mockSendExpired.mockResolvedValue(undefined)

    callbacks = createVpnRenewalCallbacks(
      mockPrismaClient as unknown as PrismaClient,
      mockEmailService as unknown as Parameters<
        typeof createVpnRenewalCallbacks
      >[1]
    )
  })

  it("suspends the satellite and its active mobile devices", async () => {
    await callbacks.onSuspend("sub-1")

    expect(mockVpnSubUpdate).toHaveBeenCalledWith({
      where: { id: "vpn-sub-1" },
      data: { status: "SUSPENDED" },
    })
    expect(mockDeviceUpdateMany).toHaveBeenCalledWith({
      where: { subscriptionId: "vpn-sub-1", status: "ACTIVE" },
      data: { status: "SUSPENDED" },
    })
  })

  it("expires the satellite, revokes devices, and removes remote accounts", async () => {
    await callbacks.onTerminate("sub-1")

    expect(mockVpnSubUpdate).toHaveBeenCalledWith({
      where: { id: "vpn-sub-1" },
      data: { status: "EXPIRED" },
    })
    expect(mockRemoveRemoteAccount).toHaveBeenCalledWith("account-1")
    expect(mockDeviceUpdateMany).toHaveBeenCalled()
  })

  it("is a no-op when no VPN satellite is linked", async () => {
    mockVpnSubFindFirst.mockResolvedValue(null)

    await callbacks.onSuspend("sub-1")

    expect(mockVpnSubUpdate).not.toHaveBeenCalled()
  })

  it("propagates a remote removal failure so the coordinator retries", async () => {
    mockRemoveRemoteAccount.mockRejectedValue(new Error("ssh unreachable"))

    await expect(callbacks.onTerminate("sub-1")).rejects.toThrow(
      "ssh unreachable"
    )
  })

  it("notifies the customer on suspend and on terminate", async () => {
    await callbacks.onSuspend("sub-1")
    expect(mockSendSuspended).toHaveBeenCalledWith("org-1")

    await callbacks.onTerminate("sub-1")
    expect(mockSendExpired).toHaveBeenCalledWith("org-1")
  })

  it("does not fail the transition when the notification fails", async () => {
    mockSendSuspended.mockRejectedValue(new Error("smtp down"))

    await callbacks.onSuspend("sub-1")

    expect(mockVpnSubUpdate).toHaveBeenCalledWith({
      where: { id: "vpn-sub-1" },
      data: { status: "SUSPENDED" },
    })
  })
})
