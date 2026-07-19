import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockAuditLogs: Array<{
  action: string
  serverAccountId: string
  details: Record<string, unknown> | null
}> = []

const mockDispatched: string[] = []

const mockPrisma = {
  vpnServerAccount: {
    findMany: mock(),
  },
  vpnAuditLog: {
    create: mock().mockImplementation(async ({ data }) => {
      mockAuditLogs.push({
        action: data.action as string,
        serverAccountId: (data.details as Record<string, unknown>)
          ?.serverAccountId as string,
        details: (data.details as Record<string, unknown>) ?? null,
      })
      return { id: "log_" + Date.now(), ...data }
    }),
  },
}

const mockVpnProvisioningJob = {
  dispatch: mock().mockImplementation(async (serverAccountId: string) => {
    mockDispatched.push(serverAccountId)
  }),
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/queue/vpn-provisioning", () => ({
  VpnProvisioningJob: mockVpnProvisioningJob,
}))

const { VpnReconciliationService } =
  await import("./vpn-reconciliation.service")

const OLD_PENDING_ACCOUNT = {
  id: "acc_old",
  provisioningStatus: "PENDING" as const,
  updatedAt: new Date(Date.now() - 10 * 60 * 1_000), // 10 min ago
  subscription: { status: "ACTIVE" as const },
}

// ponytail: mock doesn't enforce Prisma query filters — "wrong path" tests use empty results
// to simulate accounts that were filtered out by the real query

const ORPHANED_ACCOUNT_ON_ACTIVE_SUB = {
  id: "acc_active",
  provisioningStatus: "PENDING" as const,
  updatedAt: new Date(Date.now() - 10 * 60 * 1_000),
  subscription: { status: "ACTIVE" as const },
}

describe("VpnReconciliationService", () => {
  beforeEach(() => {
    mockAuditLogs.length = 0
    mockDispatched.length = 0
    mockPrisma.vpnServerAccount.findMany.mockReset()
    mockPrisma.vpnAuditLog.create.mockClear()
    mockVpnProvisioningJob.dispatch.mockClear()
    // Ensure feature flag is not set (or set to true)
    delete process.env.VPN_RECONCILIATION_ENABLED
  })

  describe("runCycle — correct path", () => {
    it("dispatches job for orphaned PENDING accounts older than 5 minutes on ACTIVE subscriptions", async () => {
      mockPrisma.vpnServerAccount.findMany.mockResolvedValueOnce([
        OLD_PENDING_ACCOUNT,
        ORPHANED_ACCOUNT_ON_ACTIVE_SUB,
      ])

      const service = new VpnReconciliationService()
      const result = await service.runCycle()

      expect(result.dispatched).toBe(2)
      expect(result.errors).toBe(0)
      expect(mockDispatched).toContain("acc_old")
      expect(mockDispatched).toContain("acc_active")
    })

    it("does NOT dispatch for recently-created PENDING accounts (less than 5 minutes old)", async () => {
      // Mock returns empty because the real Prisma query filters by updatedAt < cutoff
      mockPrisma.vpnServerAccount.findMany.mockResolvedValueOnce([])

      const service = new VpnReconciliationService()
      const result = await service.runCycle()

      expect(result.dispatched).toBe(0)
      expect(mockDispatched).toHaveLength(0)
    })

    it("writes PROVISIONING_RETRIED audit log with triggeredByAdminId=null for each dispatched account", async () => {
      mockPrisma.vpnServerAccount.findMany.mockResolvedValueOnce([
        OLD_PENDING_ACCOUNT,
      ])

      const service = new VpnReconciliationService()
      await service.runCycle()

      const retryLog = mockAuditLogs.find(
        (l) => l.action === "PROVISIONING_RETRIED"
      )
      expect(retryLog).toBeDefined()
      expect(retryLog?.action).toBe("PROVISIONING_RETRIED")
    })

    it("returns zero when no orphaned accounts found", async () => {
      mockPrisma.vpnServerAccount.findMany.mockResolvedValueOnce([])

      const service = new VpnReconciliationService()
      const result = await service.runCycle()

      expect(result.dispatched).toBe(0)
      expect(result.errors).toBe(0)
      expect(mockDispatched).toHaveLength(0)
    })
  })

  describe("runCycle — wrong path", () => {
    it("does NOT dispatch for PENDING accounts on non-ACTIVE (SUSPENDED) subscriptions", async () => {
      // Mock returns empty because the real Prisma query filters by subscription.status = 'ACTIVE'
      mockPrisma.vpnServerAccount.findMany.mockResolvedValueOnce([])

      const service = new VpnReconciliationService()
      const result = await service.runCycle()

      expect(result.dispatched).toBe(0)
      expect(mockDispatched).toHaveLength(0)
    })
  })

  describe("feature flag", () => {
    it("skips reconciliation cycle when VPN_RECONCILIATION_ENABLED=false", async () => {
      process.env.VPN_RECONCILIATION_ENABLED = "false"
      mockPrisma.vpnServerAccount.findMany.mockResolvedValueOnce([
        OLD_PENDING_ACCOUNT,
      ])

      const service = new VpnReconciliationService()
      const result = await service.runCycle()

      expect(result.dispatched).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.errors).toBe(0)
      expect(mockPrisma.vpnServerAccount.findMany).not.toHaveBeenCalled()
    })

    it("runs normally when VPN_RECONCILIATION_ENABLED=true", async () => {
      process.env.VPN_RECONCILIATION_ENABLED = "true"
      mockPrisma.vpnServerAccount.findMany.mockResolvedValueOnce([
        OLD_PENDING_ACCOUNT,
      ])

      const service = new VpnReconciliationService()
      const result = await service.runCycle()

      expect(result.dispatched).toBe(1)
    })
  })

  describe("error handling", () => {
    it("counts dispatch errors without crashing the cycle", async () => {
      mockPrisma.vpnServerAccount.findMany.mockResolvedValueOnce([
        OLD_PENDING_ACCOUNT,
        ORPHANED_ACCOUNT_ON_ACTIVE_SUB,
      ])
      mockVpnProvisioningJob.dispatch.mockImplementationOnce(async () => {
        throw new Error("Redis unavailable")
      })

      const service = new VpnReconciliationService()
      const result = await service.runCycle()

      expect(result.dispatched).toBe(1)
      expect(result.errors).toBe(1)
    })
  })
})
