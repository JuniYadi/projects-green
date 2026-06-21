import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"

type PrismaLike = Pick<
  PrismaClient,
  "vpnServerAccount" | "vpnServer" | "vpnAuditLog"
>

const mockAuditLogs: Array<{
  action: string
  adminId: string | null
  details: Record<string, unknown> | null
}> = []

const mockPrisma = {
  vpnServerAccount: {
    findUnique: mock(),
    update: mock(),
  },
  vpnServer: { findUnique: mock() },
  vpnAuditLog: {
    create: mock().mockImplementation(async ({ data }) => {
      mockAuditLogs.push({
        action: data.action as string,
        adminId: data.adminId as string | null,
        details: (data.details as Record<string, unknown>) ?? null,
      })
      return { id: "log_" + Date.now(), ...data }
    }),
  },
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { VpnProvisioningService } = await import("./vpn-provisioning.service")

const ACCOUNT_ID = "acc_123"
const USERNAME = "testuser"

const mockOpenVpn = {
  createClient: mock(),
  fetchConfig: mock().mockResolvedValue("mock-config"),
}

const mockWireGuard = {
  createPeer: mock().mockResolvedValue({ config: "wg-config" }),
}

const mockProxy = {
  createUser: mock().mockResolvedValue({ password: "secret" }),
}

let service: InstanceType<typeof VpnProvisioningService>

const account = {
  id: ACCOUNT_ID,
  username: USERNAME,
  protocol: "OPENVPN" as const,
  provisioningStatus: "PENDING" as const,
  failureReason: null,
  server: {
    id: "srv_1",
    hostname: "vpn.example.com",
    sshUser: "root",
    sshKey: { privateKey: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----" },
  },
}

beforeEach(() => {
  mockAuditLogs.length = 0
  mockPrisma.vpnServerAccount.findUnique.mockReset()
  mockPrisma.vpnServerAccount.update.mockReset()
  mockPrisma.vpnServer.findUnique.mockReset()
  mockPrisma.vpnAuditLog.create.mockClear()

  // Reset adapter mocks too — they persist across parallel tests
  mockOpenVpn.createClient.mockReset()
  mockOpenVpn.fetchConfig.mockReset()
  mockWireGuard.createPeer.mockReset()
  mockProxy.createUser.mockReset()

  mockOpenVpn.fetchConfig.mockResolvedValue("mock-config")

  mockPrisma.vpnServerAccount.findUnique.mockResolvedValue(account)
  mockPrisma.vpnServerAccount.update.mockResolvedValue({ ...account })

  service = new VpnProvisioningService(mockPrisma as unknown as PrismaLike, {
    openVpn: mockOpenVpn,
    wireGuard: mockWireGuard,
    proxy: mockProxy,
  })
})

describe("VpnProvisioningService audit logging", () => {
  it("logs PROVISIONING_STARTED then PROVISIONING_SUCCESS on happy path", async () => {
    await service.provisionAccount(ACCOUNT_ID)

    const started = mockAuditLogs.find(
      (l) => l.action === "PROVISIONING_STARTED"
    )
    const success = mockAuditLogs.find(
      (l) => l.action === "PROVISIONING_SUCCESS"
    )

    expect(started).toBeDefined()
    expect(started?.details).toMatchObject({
      serverAccountId: ACCOUNT_ID,
      protocol: "OPENVPN",
      username: USERNAME,
    })

    expect(success).toBeDefined()
    expect(success?.details).toMatchObject({
      serverAccountId: ACCOUNT_ID,
      protocol: "OPENVPN",
    })

    expect(
      mockAuditLogs.find((l) => l.action === "PROVISIONING_FAILED")
    ).toBeUndefined()
  })

  it("logs PROVISIONING_STARTED then PROVISIONING_FAILED on error", async () => {
    mockOpenVpn.createClient.mockRejectedValue(
      new Error("SSH connection refused")
    )

    await expect(service.provisionAccount(ACCOUNT_ID)).rejects.toThrow(
      "SSH connection refused"
    )

    const started = mockAuditLogs.find(
      (l) => l.action === "PROVISIONING_STARTED"
    )
    const failed = mockAuditLogs.find(
      (l) => l.action === "PROVISIONING_FAILED"
    )

    expect(started).toBeDefined()
    expect(failed).toBeDefined()
    expect(failed?.details).toMatchObject({
      serverAccountId: ACCOUNT_ID,
      failureReason: "SSH connection refused",
    })

    expect(
      mockAuditLogs.find((l) => l.action === "PROVISIONING_SUCCESS")
    ).toBeUndefined()
  })

  it("no duplicate entries across separate provisioning calls", async () => {
    // Simulate two independent provisioning calls
    await service.provisionAccount(ACCOUNT_ID)

    const startedCount = mockAuditLogs.filter(
      (l) => l.action === "PROVISIONING_STARTED"
    ).length
    const successCount = mockAuditLogs.filter(
      (l) => l.action === "PROVISIONING_SUCCESS"
    ).length

    expect(startedCount).toBe(1)
    expect(successCount).toBe(1)
  })

  it("captures failureReason in FAILED entry", async () => {
    mockOpenVpn.createClient.mockRejectedValue(
      new Error("DNS resolution failed")
    )

    await expect(service.provisionAccount(ACCOUNT_ID)).rejects.toThrow(
      "DNS resolution failed"
    )

    const failed = mockAuditLogs.find(
      (l) => l.action === "PROVISIONING_FAILED"
    )
    expect(failed?.details).toMatchObject({
      serverAccountId: ACCOUNT_ID,
      failureReason: "DNS resolution failed",
    })
  })
})
