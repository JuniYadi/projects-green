import {
  type Prisma,
  type PrismaClient,
  type VpnDeviceStatus,
  type VpnPairingMethod,
} from "@prisma/client"

import { prisma as defaultPrisma } from "@/lib/prisma"

import {
  VpnMobileDeviceAlreadyRevokedError,
  VpnMobileDeviceLimitError,
  VpnMobileDeviceNotFoundError,
} from "./vpn-mobile.errors"

type PrismaLike = PrismaClient

export type CreateMobileDeviceInput = {
  subscriptionId: string
  organizationId: string
  userId?: string | null
  deviceName: string
  deviceFingerprint: string
  platform: string
  osVersion?: string | null
  appVersion?: string | null
  pairedVia: VpnPairingMethod
  // ponytail: removed "replace-oldest-active" — device limit always rejects,
  // user must manually revoke via the devices endpoint.
}

export type ListMobileDeviceFilter = {
  status?: VpnDeviceStatus
  platform?: string
  pairedVia?: VpnPairingMethod
  search?: string
}

/**
 * CRUD service for VpnMobileDevice (T1.2).
 *
 * Owns: create (upsert on @@unique([subscriptionId, deviceFingerprint])),
 * lookup helpers, revoke/reactivate/suspend state transitions.
 *
 * Injects `now` for testability (default: () => new Date()).
 */
export class VpnMobileDeviceService {
  private readonly prisma: PrismaLike
  private readonly now: () => Date

  constructor(
    prisma: PrismaLike = defaultPrisma,
    options: { now?: () => Date } = {}
  ) {
    this.prisma = prisma
    this.now = options.now ?? (() => new Date())
  }

  /**
   * Upsert on [subscriptionId, deviceFingerprint].
   *
   * - New → create with status=ACTIVE.
   * - Existing ACTIVE/SUSPENDED → refresh lastSeenAt, return row.
   * - Existing REVOKED → reactivate: set ACTIVE, clear revoke fields,
   *   update device metadata (name, platform, osVersion, appVersion).
   *
   * When the active-device limit is reached, throws
   * {@link VpnMobileDeviceLimitError}. Caller must explicitly revoke
   * or replace a device before registering a new one.
   */
  async create(input: CreateMobileDeviceInput) {
    const existing = await this.prisma.vpnMobileDevice.findUnique({
      where: {
        subscriptionId_deviceFingerprint: {
          subscriptionId: input.subscriptionId,
          deviceFingerprint: input.deviceFingerprint,
        },
      },
    })

    if (existing) {
      if (existing.status === "REVOKED") {
        return this.prisma.vpnMobileDevice.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            revokedAt: null,
            revokedBy: null,
            revokedReason: null,
            deviceName: input.deviceName,
            platform: input.platform,
            osVersion: input.osVersion ?? null,
            appVersion: input.appVersion ?? null,
            lastSeenAt: this.now(),
          },
        })
      }
      // ACTIVE or SUSPENDED — refresh lastSeenAt and return.
      return this.prisma.vpnMobileDevice.update({
        where: { id: existing.id },
        data: { lastSeenAt: this.now() },
      })
    }

    // New device — enforce dynamic limit: active server accounts × 2
    const serverCount = await this.prisma.vpnServerAccount.count({
      where: {
        subscriptionId: input.subscriptionId,
        provisioningStatus: "ACTIVE",
      },
    })
    const maxDevices = serverCount * 2

    const activeCount = await this.prisma.vpnMobileDevice.count({
      where: {
        subscriptionId: input.subscriptionId,
        status: "ACTIVE",
      },
    })

    if (activeCount >= maxDevices) {
      throw new VpnMobileDeviceLimitError(undefined, {
        subscriptionId: input.subscriptionId,
        organizationId: input.organizationId,
      })
    }

    return this.prisma.vpnMobileDevice.create({
      data: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        userId: input.userId ?? null,
        deviceName: input.deviceName,
        deviceFingerprint: input.deviceFingerprint,
        platform: input.platform,
        osVersion: input.osVersion ?? null,
        appVersion: input.appVersion ?? null,
        pairedVia: input.pairedVia,
        status: "ACTIVE",
        lastSeenAt: this.now(),
      },
    })
  }

  /**
   * Explicitly replace one active device with a new fingerprint.
   *
   * Use case: a console user or an authenticated mobile app wants to swap
   * an old device (e.g. lost phone, reinstalled app) for a new one without
   * manually revoking and re-pairing.
   *
   * The old device is revoked with reason `REPLACED_BY_NEW_DEVICE`. If the
   * new fingerprint already maps to another row, that row is reactivated or
   * refreshed instead of creating a duplicate.
   */
  async replace(input: {
    oldDeviceId: string
    subscriptionId: string
    organizationId: string
    userId?: string | null
    deviceName: string
    deviceFingerprint: string
    platform: string
    osVersion?: string | null
    appVersion?: string | null
    pairedVia: VpnPairingMethod
    replacedBy?: string | null
    reason?: string | null
  }) {
    const old = await this.prisma.vpnMobileDevice.findUnique({
      where: { id: input.oldDeviceId },
    })
    if (!old) throw new VpnMobileDeviceNotFoundError()
    if (old.status === "REVOKED") {
      throw new VpnMobileDeviceAlreadyRevokedError()
    }
    if (
      old.subscriptionId !== input.subscriptionId ||
      old.organizationId !== input.organizationId
    ) {
      throw new VpnMobileDeviceNotFoundError()
    }

    const reason = input.reason ?? "REPLACED_BY_NEW_DEVICE"

    // If the target fingerprint already exists, reactivate/refresh it and
    // just revoke the old one. This prevents duplicates.
    const existingByFingerprint =
      await this.prisma.vpnMobileDevice.findUnique({
        where: {
          subscriptionId_deviceFingerprint: {
            subscriptionId: input.subscriptionId,
            deviceFingerprint: input.deviceFingerprint,
          },
        },
      })

    if (existingByFingerprint && existingByFingerprint.id !== old.id) {
      if (existingByFingerprint.status !== "ACTIVE") {
        await this.reactivate(existingByFingerprint.id)
      }
      await this.revoke({
        deviceId: old.id,
        revokedBy: input.replacedBy ?? input.userId,
        reason,
      })
      return this.prisma.vpnMobileDevice.update({
        where: { id: existingByFingerprint.id },
        data: {
          deviceName: input.deviceName,
          platform: input.platform,
          osVersion: input.osVersion ?? null,
          appVersion: input.appVersion ?? null,
          lastSeenAt: this.now(),
        },
      })
    }

    // Otherwise revoke the old device and create the new one.
    await this.revoke({
      deviceId: old.id,
      revokedBy: input.replacedBy ?? input.userId,
      reason,
    })

    return this.prisma.vpnMobileDevice.create({
      data: {
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId,
        userId: input.userId ?? null,
        deviceName: input.deviceName,
        deviceFingerprint: input.deviceFingerprint,
        platform: input.platform,
        osVersion: input.osVersion ?? null,
        appVersion: input.appVersion ?? null,
        pairedVia: input.pairedVia,
        status: "ACTIVE",
        lastSeenAt: this.now(),
      },
    })
  }

  findById(id: string) {
    return this.prisma.vpnMobileDevice.findUnique({ where: { id } })
  }

  findBySubscription(
    subscriptionId: string,
    filter?: { status?: VpnDeviceStatus }
  ) {
    const where: Prisma.VpnMobileDeviceWhereInput = { subscriptionId }
    if (filter?.status) {
      where.status = filter.status
    }
    return this.prisma.vpnMobileDevice.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })
  }

  findByFingerprint(subscriptionId: string, fingerprint: string) {
    return this.prisma.vpnMobileDevice.findUnique({
      where: {
        subscriptionId_deviceFingerprint: {
          subscriptionId,
          deviceFingerprint: fingerprint,
        },
      },
    })
  }

  findByUser(userId: string) {
    return this.prisma.vpnMobileDevice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
  }

  /**
   * List devices for an organization with optional filters.
   *
   * search → deviceName contains (case-insensitive).
   */
  listByOrganization(organizationId: string, filter?: ListMobileDeviceFilter) {
    const where: Prisma.VpnMobileDeviceWhereInput = { organizationId }
    if (filter?.status) where.status = filter.status
    if (filter?.platform) where.platform = filter.platform
    if (filter?.pairedVia) where.pairedVia = filter.pairedVia
    if (filter?.search) {
      where.deviceName = { contains: filter.search, mode: "insensitive" }
    }
    return this.prisma.vpnMobileDevice.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })
  }

  /**
   * Revoke a device. Sets status=REVOKED + revokedAt + revokedBy + reason.
   *
   * Throws VpnMobileDeviceNotFoundError if missing,
   * VpnMobileDeviceAlreadyRevokedError if already REVOKED.
   */
  async revoke(args: {
    deviceId: string
    revokedBy?: string | null
    reason?: string | null
  }) {
    const existing = await this.prisma.vpnMobileDevice.findUnique({
      where: { id: args.deviceId },
    })
    if (!existing) throw new VpnMobileDeviceNotFoundError()
    if (existing.status === "REVOKED") {
      throw new VpnMobileDeviceAlreadyRevokedError()
    }

    return this.prisma.vpnMobileDevice.update({
      where: { id: args.deviceId },
      data: {
        status: "REVOKED",
        revokedAt: this.now(),
        revokedBy: args.revokedBy ?? null,
        revokedReason: args.reason ?? null,
      },
    })
  }

  /**
   * Reactivate a device. Sets status=ACTIVE, clears revoked fields.
   * Throws VpnMobileDeviceNotFoundError if missing.
   */
  async reactivate(deviceId: string) {
    const existing = await this.prisma.vpnMobileDevice.findUnique({
      where: { id: deviceId },
    })
    if (!existing) throw new VpnMobileDeviceNotFoundError()

    return this.prisma.vpnMobileDevice.update({
      where: { id: deviceId },
      data: {
        status: "ACTIVE",
        revokedAt: null,
        revokedBy: null,
        revokedReason: null,
      },
    })
  }

  /**
   * Suspend a device (grace state per PRD §6.2).
   *
   * Sets status=SUSPENDED but does NOT set revokedAt — this is the
   * payment-grace state, not a permanent revoke.
   */
  async suspend(deviceId: string, reason?: string | null) {
    const existing = await this.prisma.vpnMobileDevice.findUnique({
      where: { id: deviceId },
    })
    if (!existing) throw new VpnMobileDeviceNotFoundError()

    return this.prisma.vpnMobileDevice.update({
      where: { id: deviceId },
      data: {
        status: "SUSPENDED",
        revokedReason: reason ?? null,
      },
    })
  }

  /**
   * Refresh lastSeenAt (heartbeat). No-op lookup: just update.
   */
  updateLastSeen(deviceId: string) {
    return this.prisma.vpnMobileDevice.update({
      where: { id: deviceId },
      data: { lastSeenAt: this.now() },
    })
  }

  /**
   * Update the user-facing device name.
   */
  updateName(deviceId: string, deviceName: string) {
    return this.prisma.vpnMobileDevice.update({
      where: { id: deviceId },
      data: { deviceName },
    })
  }
}

export const vpnMobileDeviceService = new VpnMobileDeviceService()
