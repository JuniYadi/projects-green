import { describe, it, expect, mock, beforeEach } from "bun:test"
import {
  parseDurationToMinutes,
  blockIpAddress,
  unblockIpAddress,
  listAppIpBlocks,
} from "./ip-block.service"
import { HAProxyIngressIpBlockAdapter } from "./ip-block.adapter"

const mockPrisma = {
  appHostingIpBlock: {
    create: mock(),
    update: mock(),
    findFirst: mock(),
    findMany: mock(),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("ip-block.service", () => {
  let adapter: HAProxyIngressIpBlockAdapter

  beforeEach(() => {
    mock.clearAllMocks()
    adapter = new HAProxyIngressIpBlockAdapter()
  })

  describe("parseDurationToMinutes", () => {
    it("maps duration strings to minute values", () => {
      expect(parseDurationToMinutes("1h")).toBe(60)
      expect(parseDurationToMinutes("24h")).toBe(1440)
      expect(parseDurationToMinutes("7d")).toBe(10080)
      expect(parseDurationToMinutes("permanent")).toBeNull()
    })
  })

  describe("blockIpAddress", () => {
    it("successfully creates active block and enforces via adapter", async () => {
      const now = new Date()
      mockPrisma.appHostingIpBlock.create.mockResolvedValueOnce({
        id: "blk_1",
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.22",
        reason: "Repeated .env probe scanner",
        durationMinutes: 60,
        status: "pending",
        errorMessage: null,
        enforcedAt: null,
        expiresAt: new Date(now.getTime() + 3600000),
        revokedAt: null,
        revokedBy: null,
        createdBy: "user_1",
        createdAt: now,
        updatedAt: now,
      })

      mockPrisma.appHostingIpBlock.update.mockResolvedValueOnce({
        id: "blk_1",
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.22",
        reason: "Repeated .env probe scanner",
        durationMinutes: 60,
        status: "active",
        errorMessage: null,
        enforcedAt: now,
        expiresAt: new Date(now.getTime() + 3600000),
        revokedAt: null,
        revokedBy: null,
        createdBy: "user_1",
        createdAt: now,
        updatedAt: now,
      })

      const block = await blockIpAddress({
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.22",
        reason: "Repeated .env probe scanner",
        duration: "1h",
        actorId: "user_1",
        adapter,
      })

      expect(block.status).toBe("active")
      expect(block.ipAddress).toBe("198.51.100.22")
      expect(adapter.isIpEnforced("st_123", "198.51.100.22")).toBe(true)
    })

    it("marks block as failed without claiming active status when enforcement fails", async () => {
      const now = new Date()
      adapter.setSimulatedFailure("198.51.100.99", true)

      mockPrisma.appHostingIpBlock.create.mockResolvedValueOnce({
        id: "blk_2",
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.99",
        reason: "High velocity scanner",
        durationMinutes: 1440,
        status: "pending",
        errorMessage: null,
        enforcedAt: null,
        expiresAt: null,
        revokedAt: null,
        revokedBy: null,
        createdBy: "user_1",
        createdAt: now,
        updatedAt: now,
      })

      mockPrisma.appHostingIpBlock.update.mockResolvedValueOnce({
        id: "blk_2",
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.99",
        reason: "High velocity scanner",
        durationMinutes: 1440,
        status: "failed",
        errorMessage:
          "Cluster ingress ACL update timed out for IP 198.51.100.99",
        enforcedAt: null,
        expiresAt: null,
        revokedAt: null,
        revokedBy: null,
        createdBy: "user_1",
        createdAt: now,
        updatedAt: now,
      })

      const block = await blockIpAddress({
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.99",
        reason: "High velocity scanner",
        duration: "24h",
        actorId: "user_1",
        adapter,
      })

      expect(block.status).toBe("failed")
      expect(block.errorMessage).toContain(
        "Cluster ingress ACL update timed out"
      )
      expect(adapter.isIpEnforced("st_123", "198.51.100.99")).toBe(false)
    })

    it("rejects invalid IP address formats", async () => {
      await expect(
        blockIpAddress({
          stackId: "st_123",
          organizationId: "org_1",
          ipAddress: "invalid-ip-format",
          reason: "Malicious traffic",
          duration: "24h",
          actorId: "user_1",
          adapter,
        })
      ).rejects.toThrow("Invalid IP address")

      await expect(
        blockIpAddress({
          stackId: "st_123",
          organizationId: "org_1",
          ipAddress: "192.168.1.0/24", // CIDR notation is out of scope for MVP
          reason: "Subnet",
          duration: "24h",
          actorId: "user_1",
          adapter,
        })
      ).rejects.toThrow("Invalid IP address")
    })

    it("rejects empty or whitespace reason", async () => {
      await expect(
        blockIpAddress({
          stackId: "st_123",
          organizationId: "org_1",
          ipAddress: "198.51.100.1",
          reason: "   ",
          duration: "24h",
          actorId: "user_1",
          adapter,
        })
      ).rejects.toThrow("A valid reason is required")
    })
  })

  describe("unblockIpAddress", () => {
    it("successfully revokes active block and removes from adapter", async () => {
      const now = new Date()
      await adapter.applyBlock({
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.22",
      })
      expect(adapter.isIpEnforced("st_123", "198.51.100.22")).toBe(true)

      mockPrisma.appHostingIpBlock.findFirst.mockResolvedValueOnce({
        id: "blk_1",
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.22",
        status: "active",
      })

      mockPrisma.appHostingIpBlock.update.mockResolvedValueOnce({
        id: "blk_1",
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.22",
        reason: "Test block",
        durationMinutes: 60,
        status: "revoked",
        errorMessage: null,
        enforcedAt: now,
        expiresAt: null,
        revokedAt: now,
        revokedBy: "user_admin",
        createdBy: "user_1",
        createdAt: now,
        updatedAt: now,
      })

      const unblocked = await unblockIpAddress({
        stackId: "st_123",
        organizationId: "org_1",
        ipAddress: "198.51.100.22",
        actorId: "user_admin",
        adapter,
      })

      expect(unblocked.status).toBe("revoked")
      expect(unblocked.revokedBy).toBe("user_admin")
      expect(adapter.isIpEnforced("st_123", "198.51.100.22")).toBe(false)
    })

    it("throws error when no active block exists to revoke", async () => {
      mockPrisma.appHostingIpBlock.findFirst.mockResolvedValueOnce(null)

      await expect(
        unblockIpAddress({
          stackId: "st_123",
          organizationId: "org_1",
          ipAddress: "198.51.100.40",
          actorId: "user_1",
          adapter,
        })
      ).rejects.toThrow("No active or pending block found")
    })
  })

  describe("listAppIpBlocks", () => {
    it("lists blocks and reconciles expired blocks", async () => {
      const past = new Date(Date.now() - 3600000)
      const now = new Date()

      mockPrisma.appHostingIpBlock.findMany.mockResolvedValueOnce([
        {
          id: "blk_expired",
          stackId: "st_123",
          organizationId: "org_1",
          ipAddress: "198.51.100.5",
          reason: "Old scan",
          durationMinutes: 60,
          status: "active",
          errorMessage: null,
          enforcedAt: past,
          expiresAt: past, // Expired
          revokedAt: null,
          revokedBy: null,
          createdBy: "user_1",
          createdAt: past,
          updatedAt: past,
        },
        {
          id: "blk_active",
          stackId: "st_123",
          organizationId: "org_1",
          ipAddress: "198.51.100.6",
          reason: "Active scan",
          durationMinutes: null,
          status: "active",
          errorMessage: null,
          enforcedAt: now,
          expiresAt: null,
          revokedAt: null,
          revokedBy: null,
          createdBy: "user_1",
          createdAt: now,
          updatedAt: now,
        },
      ])

      mockPrisma.appHostingIpBlock.update.mockResolvedValueOnce({
        id: "blk_expired",
        status: "expired",
      })

      const list = await listAppIpBlocks("st_123", "org_1", adapter)
      expect(list.length).toBe(2)
      expect(list[0].status).toBe("expired")
      expect(list[1].status).toBe("active")
      expect(mockPrisma.appHostingIpBlock.update).toHaveBeenCalledWith({
        where: { id: "blk_expired" },
        data: { status: "expired" },
      })
    })
  })
})
