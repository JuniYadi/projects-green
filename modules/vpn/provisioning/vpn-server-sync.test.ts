import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockAuditLogs: Array<{
  action: string
  serverId?: string | null
  subscriptionId?: string | null
  organizationId?: string | null
  status?: string | null
  message?: string | null
  details?: Record<string, unknown> | null
}> = []

const mockPrisma = {
  vpnServer: {
    findUniqueOrThrow: mock(),
  },
  vpnPackageServer: {
    findMany: mock(),
  },
  vpnSubscription: {
    findMany: mock(),
  },
  vpnServerAccount: {
    create: mock(),
    findMany: mock(),
  },
  vpnAuditLog: {
    create: mock().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const details = (data.details as Record<string, unknown>) ?? null
      mockAuditLogs.push({
        action: data.action as string,
        serverId: data.serverId as string | null,
        subscriptionId: data.subscriptionId as string | null,
        organizationId: data.organizationId as string | null,
        status: data.status as string | null,
        message: data.message as string | null,
        details,
      })
      return { id: "log_" + Date.now(), ...data }
    }),
  },
}

const mockDispatch = mock().mockResolvedValue(undefined)

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/queue/vpn-provisioning", () => ({
  VpnProvisioningJob: { dispatch: mockDispatch },
}))

const { vpnServerSyncService } = await import("./vpn-server-sync.service")

const SERVER_ID = "srv_1"
const SUB_ID = "sub_1"
const ORG_ID = "org_1"
const CORRELATION_ID = "vpn-sync-srv_1"

beforeEach(() => {
  mockAuditLogs.length = 0
  mockPrisma.vpnServer.findUniqueOrThrow.mockReset()
  mockPrisma.vpnPackageServer.findMany.mockReset()
  mockPrisma.vpnSubscription.findMany.mockReset()
  mockPrisma.vpnServerAccount.create.mockReset()
  mockPrisma.vpnServerAccount.findMany.mockReset()
  mockDispatch.mockReset()
  mockDispatch.mockResolvedValue(undefined)
})

describe("VpnServerSyncService", () => {
  it("creates missing WireGuard account when server enables new protocol", async () => {
    mockPrisma.vpnServer.findUniqueOrThrow.mockResolvedValue({
      id: SERVER_ID,
      name: "SG-01",
      hasOpenVpn: true,
      hasWireGuard: true,
      hasProxy: false,
    })

    mockPrisma.vpnPackageServer.findMany.mockResolvedValue([
      { id: "vps_1", packageId: "pkg_1", serverId: SERVER_ID },
    ])

    mockPrisma.vpnSubscription.findMany.mockResolvedValue([
      { id: SUB_ID, organizationId: ORG_ID, packageId: "pkg_1" },
    ])

    // Existing account is only OPENVPN
    mockPrisma.vpnServerAccount.findMany.mockResolvedValue([
      { subscriptionId: SUB_ID, protocol: "OPENVPN" },
    ])

    const createdAccount = {
      id: "acc_wg_1",
      subscriptionId: SUB_ID,
      serverId: SERVER_ID,
      protocol: "WIREGUARD",
      provisioningStatus: "PENDING" as const,
      username: "org-org-1-a1b2c3",
    }
    mockPrisma.vpnServerAccount.create.mockResolvedValue(createdAccount)

    const result = await vpnServerSyncService.sync(SERVER_ID, CORRELATION_ID)

    expect(result).toEqual({
      totalSubscriptionsChecked: 1,
      created: 1,
      skipped: 0,
    })

    expect(mockPrisma.vpnServerAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionId: SUB_ID,
          serverId: SERVER_ID,
          protocol: "WIREGUARD",
          provisioningStatus: "PENDING",
        }),
      })
    )

    expect(mockDispatch).toHaveBeenCalledWith(createdAccount.id)

    const createdLog = mockAuditLogs.find(
      (l) => l.action === "SYNC_PROTOCOLS_ACCOUNT_CREATED"
    )
    expect(createdLog).toBeDefined()
    expect(createdLog?.details).toMatchObject({
      protocol: "WIREGUARD",
    })

    const completedLog = mockAuditLogs.find(
      (l) => l.action === "SYNC_PROTOCOLS_COMPLETED"
    )
    expect(completedLog).toBeDefined()
    expect(completedLog?.details).toMatchObject({
      totalSubscriptionsChecked: 1,
      created: 1,
      skipped: 0,
    })
  })

  it("is a no-op when subscription already has all protocols", async () => {
    mockPrisma.vpnServer.findUniqueOrThrow.mockResolvedValue({
      id: SERVER_ID,
      name: "SG-01",
      hasOpenVpn: true,
      hasWireGuard: true,
      hasProxy: false,
    })

    mockPrisma.vpnPackageServer.findMany.mockResolvedValue([
      { id: "vps_1", packageId: "pkg_1", serverId: SERVER_ID },
    ])

    mockPrisma.vpnSubscription.findMany.mockResolvedValue([
      { id: SUB_ID, organizationId: ORG_ID, packageId: "pkg_1" },
    ])

    // Both OPENVPN and WIREGUARD already exist
    mockPrisma.vpnServerAccount.findMany.mockResolvedValue([
      { subscriptionId: SUB_ID, protocol: "OPENVPN" },
      { subscriptionId: SUB_ID, protocol: "WIREGUARD" },
    ])

    const result = await vpnServerSyncService.sync(SERVER_ID, CORRELATION_ID)

    expect(result).toEqual({
      totalSubscriptionsChecked: 1,
      created: 0,
      skipped: 1,
    })

    expect(mockPrisma.vpnServerAccount.create).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()

    const skippedLog = mockAuditLogs.find(
      (l) => l.action === "SYNC_PROTOCOLS_ACCOUNT_SKIPPED"
    )
    expect(skippedLog).toBeDefined()

    const completedLog = mockAuditLogs.find(
      (l) => l.action === "SYNC_PROTOCOLS_COMPLETED"
    )
    expect(completedLog).toBeDefined()
    expect(completedLog?.details).toMatchObject({
      totalSubscriptionsChecked: 1,
      created: 0,
      skipped: 1,
    })
  })

  it("throws when server does not exist", async () => {
    mockPrisma.vpnServer.findUniqueOrThrow.mockRejectedValue(
      new Error("No VpnServer found")
    )

    await expect(
      vpnServerSyncService.sync("nonexistent", CORRELATION_ID)
    ).rejects.toThrow("No VpnServer found")
  })
})
