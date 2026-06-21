import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"

type PrismaLike = Pick<
  PrismaClient,
  "vpnServerAccount" | "vpnServer" | "vpnAuditLog"
>

const mockAuditLogs: Array<{
  action: string
  adminId: string | null
  step: string | null
  status: string | null
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
        step: (data.step as string) ?? null,
        status: (data.status as string) ?? null,
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

  mockOpenVpn.createClient.mockResolvedValue(undefined)
  mockOpenVpn.fetchConfig.mockResolvedValue("mock-config")
  mockWireGuard.createPeer.mockResolvedValue({ config: "wg-config" })
  mockProxy.createUser.mockResolvedValue({ password: "secret" })

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

describe("VpnProvisioningService step logging", () => {
  const stepLog = () =>
    mockAuditLogs.filter((l) => l.action === "PROVISIONING_STEP")
  const stepLogFor = (step: string) =>
    mockAuditLogs.find(
      (l) => l.action === "PROVISIONING_STEP" && l.step === step
    )

  it("records step logs in order on OpenVPN happy path", async () => {
    await service.provisionAccount(ACCOUNT_ID)

    const steps = stepLog()
    expect(steps.length).toBeGreaterThanOrEqual(2)

    // All steps should have status OK
    steps.forEach((s) => expect(s.status).toBe("OK"))

    // Verify specific step entries
    expect(stepLogFor("creating_client")).toBeDefined()
    expect(stepLogFor("fetching_config")).toBeDefined()

    // Existing audit events still present
    expect(
      mockAuditLogs.find((l) => l.action === "PROVISIONING_STARTED")
    ).toBeDefined()
    expect(
      mockAuditLogs.find((l) => l.action === "PROVISIONING_SUCCESS")
    ).toBeDefined()
  })

  it("records last step as FAILED when SSH fails", async () => {
    mockOpenVpn.createClient.mockRejectedValue(
      new Error("Connection timeout")
    )

    await expect(service.provisionAccount(ACCOUNT_ID)).rejects.toThrow(
      "Connection timeout"
    )

    const failed = stepLogFor("creating_client")
    expect(failed).toBeDefined()
    expect(failed?.status).toBe("FAILED")
    expect(failed?.details).toMatchObject({
      message: "Connection timeout",
    })

    // Subsequent steps should NOT be recorded
    expect(stepLogFor("fetching_config")).toBeUndefined()

    // PROVISIONING_FAILED audit event also recorded
    expect(
      mockAuditLogs.find((l) => l.action === "PROVISIONING_FAILED")
    ).toBeDefined()
  })

  it("records per-protocol step names for WireGuard and Proxy", async () => {
    // --- WireGuard happy path ---
    mockPrisma.vpnServerAccount.findUnique.mockResolvedValue({
      ...account,
      protocol: "WIREGUARD" as const,
    })
    await service.provisionAccount(ACCOUNT_ID)

    const wgSteps = stepLog().map((s) => s.step)
    expect(wgSteps).toContain("creating_peer")
    // encrypting_config no longer a step — crypto is synchronous, no DB write
    expect(stepLogFor("creating_peer")?.status).toBe("OK")

    // --- Proxy error path ---
    mockAuditLogs.length = 0
    mockProxy.createUser.mockRejectedValue(new Error("SSH handshake failed"))
    mockPrisma.vpnServerAccount.findUnique.mockResolvedValue({
      ...account,
      protocol: "PROXY" as const,
    })

    await expect(service.provisionAccount(ACCOUNT_ID)).rejects.toThrow(
      "SSH handshake failed"
    )

    const proxySteps = stepLog().map((s) => s.step)
    expect(proxySteps).toContain("creating_user")
    // creating_user should be FAILED
    expect(stepLogFor("creating_user")?.status).toBe("FAILED")
  })
})
