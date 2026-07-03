import { describe, it, expect, beforeEach, mock, type Mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"

import {
  VpnMobileDeviceAlreadyRevokedError,
  VpnMobileDeviceLimitError,
  VpnMobileDeviceNotFoundError,
} from "./vpn-mobile.errors"

// ─── Mocks ──────────────────────────────────────────────────────────────
// Mock @/lib/prisma only (leaf dependency). NEVER mock sibling services.

type MockFn = (args: unknown) => Promise<unknown>

type MockPrismaClient = {
  vpnMobileDevice: {
    findUnique: Mock<MockFn>
    findMany: Mock<MockFn>
    findFirst: Mock<MockFn>
    create: Mock<MockFn>
    update: Mock<MockFn>
    count: Mock<MockFn>
  }
  vpnServerAccount: { count: Mock<MockFn> }
}

const findUnique = mock<MockFn>(async () => null as unknown)
const findMany = mock<MockFn>(async () => [] as unknown)
const findFirst = mock<MockFn>(async () => null as unknown)
const create = mock<MockFn>(async () => ({}) as unknown)
const update = mock<MockFn>(async () => ({}) as unknown)
const count = mock<MockFn>(async () => 0 as unknown)

const mockPrisma: MockPrismaClient = {
  vpnMobileDevice: { findUnique, findMany, findFirst, create, update, count },
  vpnServerAccount: { count },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma as unknown as PrismaClient,
}))

import { prisma } from "@/lib/prisma"
import { VpnMobileDeviceService } from "./vpn-mobile-device.service"

const prismaMock = prisma as unknown as MockPrismaClient

const NOW = new Date("2026-06-16T12:00:00Z")
const service = new VpnMobileDeviceService(
  prismaMock as unknown as PrismaClient,
  { now: () => NOW }
)

const activeDevice = {
  id: "dev-1",
  organizationId: "org-1",
  subscriptionId: "sub-1",
  userId: "user-1",
  deviceName: "iPhone 15 Pro",
  deviceFingerprint: "fp-abc",
  platform: "ios",
  osVersion: "18.2.1",
  appVersion: "1.0.0",
  pairedVia: "SSO" as const,
  status: "ACTIVE" as const,
  lastSeenAt: null,
  revokedAt: null,
  revokedReason: null,
  revokedBy: null,
  createdAt: new Date("2026-06-14T00:00:00Z"),
  updatedAt: new Date("2026-06-14T00:00:00Z"),
}

const revokedDevice = {
  ...activeDevice,
  id: "dev-revoked",
  status: "REVOKED" as const,
  revokedAt: new Date("2026-06-15T00:00:00Z"),
  revokedBy: "admin-1",
  revokedReason: "Compromised",
}

const createInput = {
  subscriptionId: "sub-1",
  organizationId: "org-1",
  userId: "user-1" as string | null | undefined,
  deviceName: "iPhone 15 Pro",
  deviceFingerprint: "fp-abc",
  platform: "ios",
  osVersion: "18.2.1" as string | null | undefined,
  appVersion: "1.0.0" as string | null | undefined,
  pairedVia: "SSO" as const,
}

beforeEach(() => {
  // Reset both call history and any queued mockResolvedValueOnce overrides.
  findUnique.mockReset()
  findMany.mockReset()
  findFirst.mockReset()
  create.mockReset()
  update.mockReset()
  count.mockReset()
  // Reset default resolved values.
  findUnique.mockResolvedValue(null)
  findMany.mockResolvedValue([])
  findFirst.mockResolvedValue(null)
  create.mockResolvedValue(activeDevice)
  update.mockResolvedValue(activeDevice)
  count.mockResolvedValue(0)
})

describe("VpnMobileDeviceService", () => {
  describe("create", () => {
    it("creates a new device when none exists", async () => {
      findUnique.mockResolvedValue(null)
      count.mockResolvedValueOnce(3) // serverCount = 3 → limit = 6
      count.mockResolvedValueOnce(0) // active devices = 0 (below limit)
      create.mockResolvedValue(activeDevice)

      const result = await service.create(createInput)

      expect(result).toEqual(activeDevice)
      expect(prismaMock.vpnMobileDevice.findUnique).toHaveBeenCalledWith({
        where: {
          subscriptionId_deviceFingerprint: {
            subscriptionId: "sub-1",
            deviceFingerprint: "fp-abc",
          },
        },
      })
      expect(prismaMock.vpnMobileDevice.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          subscriptionId: "sub-1",
          userId: "user-1",
          deviceName: "iPhone 15 Pro",
          deviceFingerprint: "fp-abc",
          platform: "ios",
          osVersion: "18.2.1",
          appVersion: "1.0.0",
          pairedVia: "SSO",
          status: "ACTIVE",
          lastSeenAt: NOW,
        },
      })
    })

    it("refreshes lastSeenAt when device exists and ACTIVE", async () => {
      findUnique.mockResolvedValue(activeDevice)
      update.mockResolvedValue({ ...activeDevice, lastSeenAt: NOW })

      const result = await service.create(createInput)

      expect(result.lastSeenAt).toEqual(NOW)
      expect(prismaMock.vpnMobileDevice.update).toHaveBeenCalledWith({
        where: { id: activeDevice.id },
        data: { lastSeenAt: NOW },
      })
      // Should NOT call create when upsert-update branch fires.
      expect(prismaMock.vpnMobileDevice.create).not.toHaveBeenCalled()
    })

    it("refreshes lastSeenAt when device exists and SUSPENDED", async () => {
      const suspended = { ...activeDevice, status: "SUSPENDED" as const }
      findUnique.mockResolvedValue(suspended)
      update.mockResolvedValue({ ...suspended, lastSeenAt: NOW })

      const result = await service.create(createInput)

      expect(result.lastSeenAt).toEqual(NOW)
      expect(prismaMock.vpnMobileDevice.update).toHaveBeenCalledWith({
        where: { id: suspended.id },
        data: { lastSeenAt: NOW },
      })
    })

    it("reactivates REVOKED device and clears revoke fields", async () => {
      findUnique.mockResolvedValue(revokedDevice)
      const reactivated = {
        ...revokedDevice,
        status: "ACTIVE",
        revokedAt: null,
        revokedBy: null,
        revokedReason: null,
        deviceName: createInput.deviceName,
        platform: createInput.platform,
        osVersion: createInput.osVersion,
        appVersion: createInput.appVersion,
        lastSeenAt: NOW,
      }
      update.mockResolvedValue(reactivated)

      const result = await service.create(createInput)

      expect(result.status).toBe("ACTIVE")
      expect(result.revokedAt).toBeNull()
      expect(result.revokedBy).toBeNull()
      expect(result.revokedReason).toBeNull()
      expect(result.deviceName).toBe(createInput.deviceName)
      expect(prismaMock.vpnMobileDevice.update).toHaveBeenCalledWith({
        where: { id: revokedDevice.id },
        data: {
          status: "ACTIVE",
          revokedAt: null,
          revokedBy: null,
          revokedReason: null,
          deviceName: createInput.deviceName,
          platform: createInput.platform,
          osVersion: createInput.osVersion ?? null,
          appVersion: createInput.appVersion ?? null,
          lastSeenAt: NOW,
        },
      })
      expect(prismaMock.vpnMobileDevice.create).not.toHaveBeenCalled()
    })

    it("creates device when under limit", async () => {
      findUnique.mockResolvedValue(null)
      count.mockResolvedValueOnce(2) // serverCount = 2
      count.mockResolvedValueOnce(1) // active devices = 1 (below 4)
      create.mockResolvedValue(activeDevice)

      const result = await service.create(createInput)

      expect(result).toEqual(activeDevice)
      expect(prismaMock.vpnServerAccount.count).toHaveBeenCalledWith({
        where: {
          subscriptionId: "sub-1",
          provisioningStatus: "ACTIVE",
        },
      })
      expect(prismaMock.vpnMobileDevice.count).toHaveBeenCalledWith({
        where: {
          subscriptionId: "sub-1",
          status: "ACTIVE",
        },
      })
      expect(prismaMock.vpnMobileDevice.create).toHaveBeenCalled()
    })

    it("throws VpnMobileDeviceLimitError when device count >= limit", async () => {
      findUnique.mockResolvedValue(null)
      count.mockResolvedValueOnce(1) // serverCount = 1 → limit = 2
      count.mockResolvedValueOnce(2) // active devices = 2 (at limit)

      await expect(service.create(createInput)).rejects.toThrow(
        VpnMobileDeviceLimitError
      )
      expect(prismaMock.vpnMobileDevice.create).not.toHaveBeenCalled()
    })

    it("throws VpnMobileDeviceLimitError when QR path hits limit", async () => {
      findUnique.mockResolvedValue(null)
      count.mockResolvedValueOnce(1) // serverCount = 1 → limit = 2
      count.mockResolvedValueOnce(2) // active devices = 2 (at limit)

      await expect(
        service.create({
          ...createInput,
          userId: null,
          pairedVia: "QR",
        })
      ).rejects.toThrow(VpnMobileDeviceLimitError)
      expect(prismaMock.vpnMobileDevice.create).not.toHaveBeenCalled()
    })

    it("throws VpnMobileDeviceLimitError when serverCount is 0 (limit = 0)", async () => {
      findUnique.mockResolvedValue(null)
      count.mockResolvedValueOnce(0) // serverCount = 0 → limit = 0
      count.mockResolvedValueOnce(0) // active devices = 0 (0 >= 0)

      await expect(service.create(createInput)).rejects.toThrow(
        VpnMobileDeviceLimitError
      )
      expect(prismaMock.vpnMobileDevice.create).not.toHaveBeenCalled()
    })

    it("bypasses limit check for existing ACTIVE/SUSPENDED devices", async () => {
      findUnique.mockResolvedValue(activeDevice)
      update.mockResolvedValue({ ...activeDevice, lastSeenAt: NOW })

      const result = await service.create(createInput)

      expect(result.lastSeenAt).toEqual(NOW)
      // Should NOT call server count or device count at all
      expect(prismaMock.vpnServerAccount.count).not.toHaveBeenCalled()
      expect(prismaMock.vpnMobileDevice.count).not.toHaveBeenCalled()
      expect(prismaMock.vpnMobileDevice.create).not.toHaveBeenCalled()
    })
  })

  describe("findById", () => {
    it("returns the device by id", async () => {
      findUnique.mockResolvedValue(activeDevice)
      const result = await service.findById("dev-1")
      expect(result).toEqual(activeDevice)
      expect(prismaMock.vpnMobileDevice.findUnique).toHaveBeenCalledWith({
        where: { id: "dev-1" },
      })
    })
  })

  describe("findBySubscription", () => {
    it("lists devices by subscription with status filter", async () => {
      findMany.mockResolvedValue([activeDevice])
      const result = await service.findBySubscription("sub-1", {
        status: "ACTIVE",
      })
      expect(result).toEqual([activeDevice])
      expect(prismaMock.vpnMobileDevice.findMany).toHaveBeenCalledWith({
        where: { subscriptionId: "sub-1", status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      })
    })

    it("lists devices without filter when omitted", async () => {
      findMany.mockResolvedValue([activeDevice])
      await service.findBySubscription("sub-1")
      expect(prismaMock.vpnMobileDevice.findMany).toHaveBeenCalledWith({
        where: { subscriptionId: "sub-1" },
        orderBy: { createdAt: "desc" },
      })
    })
  })

  describe("findByFingerprint", () => {
    it("returns the device by subscription+fingerprint", async () => {
      findUnique.mockResolvedValue(activeDevice)
      const result = await service.findByFingerprint("sub-1", "fp-abc")
      expect(result).toEqual(activeDevice)
      expect(prismaMock.vpnMobileDevice.findUnique).toHaveBeenCalledWith({
        where: {
          subscriptionId_deviceFingerprint: {
            subscriptionId: "sub-1",
            deviceFingerprint: "fp-abc",
          },
        },
      })
    })
  })

  describe("findByUser", () => {
    it("lists devices by userId", async () => {
      findMany.mockResolvedValue([activeDevice])
      const result = await service.findByUser("user-1")
      expect(result).toEqual([activeDevice])
      expect(prismaMock.vpnMobileDevice.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      })
    })
  })

  describe("listByOrganization", () => {
    it("lists devices with search filter (deviceName contains)", async () => {
      findMany.mockResolvedValue([activeDevice])
      await service.listByOrganization("org-1", { search: "iPhone" })
      expect(prismaMock.vpnMobileDevice.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          deviceName: { contains: "iPhone", mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
      })
    })

    it("lists devices with status + platform filters", async () => {
      findMany.mockResolvedValue([activeDevice])
      await service.listByOrganization("org-1", {
        status: "ACTIVE",
        platform: "ios",
      })
      expect(prismaMock.vpnMobileDevice.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          status: "ACTIVE",
          platform: "ios",
        },
        orderBy: { createdAt: "desc" },
      })
    })

    it("lists all org devices when no filter", async () => {
      findMany.mockResolvedValue([activeDevice])
      await service.listByOrganization("org-1")
      expect(prismaMock.vpnMobileDevice.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { createdAt: "desc" },
      })
    })
  })

  describe("replace", () => {
    it("revokes old device and creates a new one with new fingerprint", async () => {
      const oldDevice = { ...activeDevice, id: "dev-old" }
      const newDevice = {
        ...activeDevice,
        id: "dev-new",
        deviceFingerprint: "fp-new",
      }

      findUnique
        .mockResolvedValueOnce(oldDevice) // old device lookup
        .mockResolvedValueOnce(null) // fingerprint lookup
        .mockResolvedValueOnce(oldDevice) // revoke's lookup
      update.mockResolvedValueOnce({
        ...oldDevice,
        status: "REVOKED",
        revokedAt: NOW,
        revokedBy: "user-1",
        revokedReason: "REPLACED_BY_NEW_DEVICE",
      })
      create.mockResolvedValueOnce(newDevice)

      const result = await service.replace({
        oldDeviceId: "dev-old",
        subscriptionId: "sub-1",
        organizationId: "org-1",
        userId: "user-1",
        deviceName: "iPhone 15 Pro",
        deviceFingerprint: "fp-new",
        platform: "ios",
        osVersion: "18.2.1",
        appVersion: "1.0.0",
        pairedVia: "SSO",
      })

      expect(result).toEqual(newDevice)
      expect(prismaMock.vpnMobileDevice.update).toHaveBeenCalledWith({
        where: { id: "dev-old" },
        data: {
          status: "REVOKED",
          revokedAt: NOW,
          revokedBy: "user-1",
          revokedReason: "REPLACED_BY_NEW_DEVICE",
        },
      })
      expect(prismaMock.vpnMobileDevice.create).toHaveBeenCalledWith({
        data: {
          organizationId: "org-1",
          subscriptionId: "sub-1",
          userId: "user-1",
          deviceName: "iPhone 15 Pro",
          deviceFingerprint: "fp-new",
          platform: "ios",
          osVersion: "18.2.1",
          appVersion: "1.0.0",
          pairedVia: "SSO",
          status: "ACTIVE",
          lastSeenAt: NOW,
        },
      })
    })

    it("reactivates target fingerprint if it already maps to a revoked device", async () => {
      const oldDevice = { ...activeDevice, id: "dev-old" }
      const existingNew = {
        ...activeDevice,
        id: "dev-existing",
        status: "REVOKED" as const,
      }

      findUnique
        .mockResolvedValueOnce(oldDevice) // old device lookup
        .mockResolvedValueOnce(existingNew) // fingerprint lookup
        .mockResolvedValueOnce(existingNew) // reactivate's lookup
        .mockResolvedValueOnce(oldDevice) // revoke's lookup
      update
        .mockResolvedValueOnce({
          ...existingNew,
          status: "ACTIVE",
          revokedAt: null,
          revokedBy: null,
          revokedReason: null,
        })
        .mockResolvedValueOnce({
          ...oldDevice,
          status: "REVOKED",
          revokedAt: NOW,
          revokedBy: "user-1",
          revokedReason: "REPLACED_BY_NEW_DEVICE",
        })

      const result = await service.replace({
        oldDeviceId: "dev-old",
        subscriptionId: "sub-1",
        organizationId: "org-1",
        userId: "user-1",
        deviceName: "iPhone 15 Pro",
        deviceFingerprint: "fp-existing",
        platform: "ios",
        pairedVia: "SSO",
      })

      expect(result.status).toBe("ACTIVE")
      expect(prismaMock.vpnMobileDevice.create).not.toHaveBeenCalled()
    })

    it("throws when old device does not exist", async () => {
      findUnique.mockResolvedValue(null)

      await expect(
        service.replace({
          oldDeviceId: "missing",
          subscriptionId: "sub-1",
          organizationId: "org-1",
          deviceName: "iPhone",
          deviceFingerprint: "fp-new",
          platform: "ios",
          pairedVia: "SSO",
        })
      ).rejects.toThrow(VpnMobileDeviceNotFoundError)
    })

    it("throws when old device is already revoked", async () => {
      findUnique.mockResolvedValue(revokedDevice)

      await expect(
        service.replace({
          oldDeviceId: "dev-revoked",
          subscriptionId: "sub-1",
          organizationId: "org-1",
          deviceName: "iPhone",
          deviceFingerprint: "fp-new",
          platform: "ios",
          pairedVia: "SSO",
        })
      ).rejects.toThrow(VpnMobileDeviceAlreadyRevokedError)
    })

    it("throws when old device belongs to a different subscription", async () => {
      findUnique.mockResolvedValue({ ...activeDevice, subscriptionId: "sub-2" })

      await expect(
        service.replace({
          oldDeviceId: "dev-1",
          subscriptionId: "sub-1",
          organizationId: "org-1",
          deviceName: "iPhone",
          deviceFingerprint: "fp-new",
          platform: "ios",
          pairedVia: "SSO",
        })
      ).rejects.toThrow(VpnMobileDeviceNotFoundError)
    })
  })

  describe("revoke", () => {
    it("revokes an ACTIVE device", async () => {
      findUnique.mockResolvedValue(activeDevice)
      update.mockResolvedValue({
        ...activeDevice,
        status: "REVOKED",
        revokedAt: NOW,
        revokedBy: "admin-1",
        revokedReason: "Lost device",
      })

      const result = await service.revoke({
        deviceId: "dev-1",
        revokedBy: "admin-1",
        reason: "Lost device",
      })

      expect(result.status).toBe("REVOKED")
      expect(prismaMock.vpnMobileDevice.update).toHaveBeenCalledWith({
        where: { id: "dev-1" },
        data: {
          status: "REVOKED",
          revokedAt: NOW,
          revokedBy: "admin-1",
          revokedReason: "Lost device",
        },
      })
    })

    it("throws VpnMobileDeviceNotFoundError when device missing", async () => {
      findUnique.mockResolvedValue(null)
      await expect(service.revoke({ deviceId: "missing" })).rejects.toThrow(
        VpnMobileDeviceNotFoundError
      )
    })

    it("throws VpnMobileDeviceAlreadyRevokedError when already REVOKED", async () => {
      findUnique.mockResolvedValue(revokedDevice)
      await expect(service.revoke({ deviceId: "dev-revoked" })).rejects.toThrow(
        VpnMobileDeviceAlreadyRevokedError
      )
      expect(prismaMock.vpnMobileDevice.update).not.toHaveBeenCalled()
    })
  })

  describe("suspend", () => {
    it("sets status=SUSPENDED and does NOT set revokedAt", async () => {
      findUnique.mockResolvedValue(activeDevice)
      update.mockResolvedValue({ ...activeDevice, status: "SUSPENDED" })

      await service.suspend("dev-1", "Payment failed")

      expect(prismaMock.vpnMobileDevice.update).toHaveBeenCalledWith({
        where: { id: "dev-1" },
        data: {
          status: "SUSPENDED",
          revokedReason: "Payment failed",
        },
      })
      // Verify revokedAt is NOT in the data payload.
      const call = update.mock.calls[0]?.[0] as {
        data: Record<string, unknown>
      }
      expect(call.data).not.toHaveProperty("revokedAt")
    })

    it("throws VpnMobileDeviceNotFoundError when device missing", async () => {
      findUnique.mockResolvedValue(null)
      await expect(service.suspend("missing")).rejects.toThrow(
        VpnMobileDeviceNotFoundError
      )
    })
  })

  describe("reactivate", () => {
    it("clears revoked fields and sets ACTIVE", async () => {
      findUnique.mockResolvedValue(revokedDevice)
      update.mockResolvedValue({
        ...revokedDevice,
        status: "ACTIVE",
        revokedAt: null,
        revokedBy: null,
        revokedReason: null,
      })

      await service.reactivate("dev-revoked")

      expect(prismaMock.vpnMobileDevice.update).toHaveBeenCalledWith({
        where: { id: "dev-revoked" },
        data: {
          status: "ACTIVE",
          revokedAt: null,
          revokedBy: null,
          revokedReason: null,
        },
      })
    })

    it("throws VpnMobileDeviceNotFoundError when device missing", async () => {
      findUnique.mockResolvedValue(null)
      await expect(service.reactivate("missing")).rejects.toThrow(
        VpnMobileDeviceNotFoundError
      )
    })
  })

  describe("updateLastSeen", () => {
    it("updates lastSeenAt", async () => {
      update.mockResolvedValue({ ...activeDevice, lastSeenAt: NOW })
      await service.updateLastSeen("dev-1")
      expect(prismaMock.vpnMobileDevice.update).toHaveBeenCalledWith({
        where: { id: "dev-1" },
        data: { lastSeenAt: NOW },
      })
    })
  })

  describe("updateName", () => {
    it("updates deviceName", async () => {
      update.mockResolvedValue({ ...activeDevice, deviceName: "New Name" })
      await service.updateName("dev-1", "New Name")
      expect(prismaMock.vpnMobileDevice.update).toHaveBeenCalledWith({
        where: { id: "dev-1" },
        data: { deviceName: "New Name" },
      })
    })
  })
})
