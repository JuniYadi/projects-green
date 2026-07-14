/**
 * WhatsApp Devices — Service layer
 * Org-scoped CRUD operations via Prisma.
 *
 * NOTE: The Prisma model (WhatsappDevice) does NOT yet have an
 * `environment` column. `environment` (SANDBOX/LIVE) is accepted on
 * create/update but not persisted - add that column in a follow-up migration.
 */

import { randomBytes } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { encryptWhatsAppToken } from "@/lib/whatsapp/crypto"

/**
 * Generate a cryptographically secure signing secret for webhook HMAC verification.
 * Returns a 32-byte hex string (64 characters).
 */
export function generateWebhookSigningSecret(): string {
  return randomBytes(32).toString("hex")
}

import {
  DEFAULT_QUOTA_BASE,
  type DeviceService,
  type DeviceDetail,
  type DeviceListItem,
  type DeviceCreateInput,
  type UpdateDeviceInput,
  type DeviceStatus,
  DeviceNotFoundError,
  DeviceNotOwnedError,
} from "./devices.schemas"

// ─── Mappers ──────────────────────────────────────────────────────────────────

// NOTE: Use unknown for Prisma Decimal fields, convert with Number() in mapper
type PrismaDeviceFields = {
  id: string
  organizationId: string
  phoneNumber: string
  status: import("@prisma/client").WhatsappDeviceStatus
  balance: unknown
  quotaBase: unknown
  quotaBaseOut: unknown
  dailyLimitMessage: number
  whatsappBusinessAccountId: string | null
  whatsappPhoneId: string | null
  createdAt: Date
  updatedAt: Date
  callbackUrl: string | null
  expiredAt: Date | null
  whatsappProfile: Record<string, unknown> | null
  features: Record<string, unknown> | null
}

const toDeviceListItem = (d: PrismaDeviceFields): DeviceListItem => ({
  id: d.id,
  organizationId: d.organizationId,
  phoneNumber: d.phoneNumber,
  name: d.phoneNumber, // Schema does not have name, use phoneNumber
  status: d.status as DeviceStatus,
  environment: "LIVE",
  balance: Number(d.balance),
  quotaBase: Number(d.quotaBase),
  quotaBaseOut: Number(d.quotaBaseOut),
  dailyLimitMessage: d.dailyLimitMessage,
  whatsappBusinessAccountId: d.whatsappBusinessAccountId,
  whatsappPhoneId: d.whatsappPhoneId,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
})

const _toDeviceDetail = (d: PrismaDeviceFields): DeviceDetail => ({
  ...toDeviceListItem(d),
  businessId: null,
  callbackUrl: d.callbackUrl,
  expiredAt: d.expiredAt?.toISOString() ?? null,
  whatsappProfile: d.whatsappProfile,
  features: d.features,
})

// ─── Factory ──────────────────────────────────────────────────────────────────

export const createDeviceService = (
  options: { prisma?: typeof prisma } = {}
): DeviceService => {
  const db = options.prisma ?? prisma

  return {
    async listByOrganization(organizationId) {
      const devices = await db.whatsappDevice.findMany({
        where: organizationId ? { organizationId } : {},
        orderBy: { createdAt: "desc" },
      })
      return devices.map((d) => toDeviceListItem(d as PrismaDeviceFields))
    },

    async findById(id, organizationId) {
      const device = await db.whatsappDevice.findUnique({ where: { id } })
      if (!device) throw new DeviceNotFoundError(id)
      if (organizationId && device.organizationId !== organizationId) {
        throw new DeviceNotOwnedError()
      }
      return _toDeviceDetail(device as PrismaDeviceFields)
    },

    async create(input: DeviceCreateInput) {
      const tokenEncrypted = input.token
        ? await encryptWhatsAppToken(input.token)
        : null
      const device = await db.whatsappDevice.create({
        data: {
          organizationId: input.organizationId ?? "",
          phoneNumber: input.phoneNumber,
          status: "ACTIVE",
          whatsappBusinessAccountId: input.whatsappBusinessAccountId ?? null,
          whatsappPhoneId: input.whatsappPhoneId ?? null,
          whatsappApplicationId: input.whatsappApplicationId ?? null,
          callbackUrl: input.callbackUrl || null,
          whatsappVersion: input.whatsappVersion ?? "v24.0",
          token: null,
          tokenEncrypted,
          tokenIv: null,
          rates: input.rates ?? null,
          s3Path: input.s3 ?? null,
          quotaBase: input.quotaBase ?? DEFAULT_QUOTA_BASE,
          quotaBaseOut: input.quotaBaseOut ?? 0,
          dailyLimitMessage: input.dailyLimitMessage ?? 0,
          ...(input.balance != null ? { balance: input.balance } : {}),
          ...(input.expiredAt ? { expiredAt: new Date(input.expiredAt) } : {}),
          ...(input.features
            ? { features: input.features as Prisma.InputJsonValue }
            : {}),
          ...(input.displayName || input.whatsappProfile
            ? {
                whatsappProfile: {
                  ...(input.whatsappProfile ?? {}),
                  ...(input.displayName ? { name: input.displayName } : {}),
                } as Prisma.InputJsonValue,
              }
            : {}),
          appSecret: generateWebhookSigningSecret(),
        },
      })
      return _toDeviceDetail(device as PrismaDeviceFields)
    },

    async update(id, input, _organizationId) {
      const tokenEncrypted = input.token
        ? await encryptWhatsAppToken(input.token)
        : undefined
      const updated = await db.$transaction(async (tx) => {
        const existing = await tx.whatsappDevice.findUnique({
          where: { id },
        })
        if (!existing) throw new DeviceNotFoundError(id)

        return tx.whatsappDevice.update({
          where: { id },
          data: {
            phoneNumber: input.phoneNumber ?? undefined,
            status: input.status ?? undefined,
            token: tokenEncrypted ? null : undefined,
            tokenEncrypted,
            tokenIv: tokenEncrypted ? null : undefined,
            whatsappBusinessAccountId:
              input.whatsappBusinessAccountId !== undefined
                ? input.whatsappBusinessAccountId || null
                : undefined,
            whatsappPhoneId:
              input.whatsappPhoneId !== undefined
                ? input.whatsappPhoneId || null
                : undefined,
            whatsappApplicationId:
              input.whatsappApplicationId !== undefined
                ? input.whatsappApplicationId || null
                : undefined,
            whatsappVersion: input.whatsappVersion || undefined,
            quotaBase: input.quotaBase ?? undefined,
            quotaBaseOut: input.quotaBaseOut ?? undefined,
            dailyLimitMessage: input.dailyLimitMessage ?? undefined,
            balance: input.balance ?? undefined,
            expiredAt: input.expiredAt ? new Date(input.expiredAt) : undefined,
            rates: input.rates !== undefined ? input.rates || null : undefined,
            s3Path: input.s3 !== undefined ? input.s3 || null : undefined,
            features:
              input.features !== undefined
                ? (input.features as Prisma.InputJsonValue)
                : undefined,
            whatsappProfile:
              input.displayName !== undefined ||
              input.whatsappProfile !== undefined
                ? ({
                    ...(input.whatsappProfile ?? {}),
                    ...(input.displayName ? { name: input.displayName } : {}),
                  } as Prisma.InputJsonValue)
                : undefined,
            callbackUrl:
              input.callbackUrl !== undefined
                ? input.callbackUrl || null
                : undefined,
          },
        })
      })
      return _toDeviceDetail(updated as PrismaDeviceFields)
    },

    async delete(id) {
      await db.$transaction(async (tx) => {
        const existing = await tx.whatsappDevice.findUnique({
          where: { id },
        })
        if (!existing) throw new DeviceNotFoundError(id)
        await tx.whatsappDevice.delete({ where: { id } })
      })
    },

    async verify(id, organizationId) {
      const device = await db.whatsappDevice.findUnique({ where: { id } })
      if (!device) throw new DeviceNotFoundError(id)
      if (organizationId && device.organizationId !== organizationId) {
        throw new DeviceNotOwnedError()
      }

      const updated = await db.whatsappDevice.update({
        where: { id },
        data: {
          status: "ACTIVE",
          // lastVerifiedAt: add column in follow-up
        },
      })
      return _toDeviceDetail(updated as PrismaDeviceFields)
    },

    async updateLastHeartbeat(deviceId: string): Promise<void> {
      await db.whatsappDevice.update({
        where: { id: deviceId },
        data: { lastHeartbeatAt: new Date() },
      })
    },

    async markDisconnected(deviceId: string): Promise<void> {
      await db.whatsappDevice.update({
        where: { id: deviceId },
        data: {
          status: "DISCONNECTED",
          lastDisconnectedAt: new Date(),
        },
      })
    },

    async markActive(deviceId: string): Promise<void> {
      await db.whatsappDevice.update({
        where: { id: deviceId },
        data: { status: "ACTIVE" },
      })
    },

    async reconnect(id, organizationId) {
      const device = await db.whatsappDevice.findUnique({ where: { id } })
      if (!device) throw new DeviceNotFoundError(id)
      if (organizationId && device.organizationId !== organizationId) {
        throw new DeviceNotOwnedError()
      }

      const updated = await db.whatsappDevice.update({
        where: { id },
        data: { status: "ACTIVE" },
      })
      return _toDeviceDetail(updated as PrismaDeviceFields)
    },

    async regenerateSigningSecret(id, organizationId) {
      const device = await db.whatsappDevice.findUnique({ where: { id } })
      if (!device) throw new DeviceNotFoundError(id)
      if (organizationId && device.organizationId !== organizationId) {
        throw new DeviceNotOwnedError()
      }

      const newSecret = generateWebhookSigningSecret()
      await db.whatsappDevice.update({
        where: { id },
        data: { appSecret: newSecret },
      })
      return newSecret
    },

    async topUpAddonQuota(id, amount) {
      if (amount <= 0) throw new Error("AMOUNT_MUST_BE_POSITIVE")
      const device = await db.whatsappDevice.findUnique({ where: { id } })
      if (!device) throw new DeviceNotFoundError(id)
      const updated = await db.whatsappDevice.update({
        where: { id },
        data: {
          addonQuota: { increment: amount },
          addonQuotaTotal: { increment: amount },
        },
      })
      return _toDeviceDetail(updated as PrismaDeviceFields)
    },
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const devicesService = createDeviceService()
