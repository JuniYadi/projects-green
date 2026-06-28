/**
 * WhatsApp Devices — Service layer
 * Org-scoped CRUD operations via Prisma.
 *
 * NOTE: The Prisma model (WhatsappDevice) does NOT yet have an
 * `environment` column. `environment` (SANDBOX/LIVE) is accepted on
 * create/update but not persisted - add that column in a follow-up migration.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { encryptWhatsAppToken } from "@/lib/whatsapp/crypto"

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
  quotaBaseOut: number
  dailyLimitMessage: number
  whatsappBusinessAccountId: string | null
  whatsappPhoneId: string | null
  lastHeartbeatAt: Date | null
  lastDisconnectedAt: Date | null
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
  quotaBaseOut: d.quotaBaseOut,
  dailyLimitMessage: d.dailyLimitMessage,
  whatsappBusinessAccountId: d.whatsappBusinessAccountId,
  whatsappPhoneId: d.whatsappPhoneId,
  lastHeartbeatAt: d.lastHeartbeatAt?.toISOString() ?? null,
  lastDisconnectedAt: d.lastDisconnectedAt?.toISOString() ?? null,
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
          quotaBaseIn: input.quotaBaseIn ?? 0,
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
            quotaBaseIn: input.quotaBaseIn ?? undefined,
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

    async reconnect(id, organizationId) {
      const device = await db.whatsappDevice.findUnique({ where: { id } })
      if (!device) throw new DeviceNotFoundError(id)
      if (organizationId && device.organizationId !== organizationId) {
        throw new DeviceNotOwnedError()
      }

      // Clear miss counter so device isn't immediately re-marked DISCONNECTED
      const { getRedis } = await import("@/lib/queue/whatsapp-health")
      const redis = getRedis()
      await redis.del(`whatsapp:health:miss:${id}`).catch(() => {})

      const updated = await db.whatsappDevice.update({
        where: { id },
        data: { status: "ACTIVE", lastDisconnectedAt: null },
      })
      return _toDeviceDetail(updated as PrismaDeviceFields)
    },
  }
}

// ─── Standalone health functions (exported for use by job & API routes) ─────

export async function updateLastHeartbeat(
  deviceId: string
): Promise<void> {
  await prisma.whatsappDevice.update({
    where: { id: deviceId },
    data: { lastHeartbeatAt: new Date() },
  })
}

export async function markDisconnected(
  deviceId: string
): Promise<void> {
  const device = await prisma.whatsappDevice.findUnique({
    where: { id: deviceId },
    select: { id: true, organizationId: true, phoneNumber: true },
  })
  if (!device) return

  await prisma.whatsappDevice.update({
    where: { id: deviceId },
    data: { status: "DISCONNECTED", lastDisconnectedAt: new Date() },
  })

  // Audit log
  const { logWhatsappAuditEvent } = await import(
    "@/modules/whatsapp/audit/whatsapp-audit.service"
  )
  await logWhatsappAuditEvent({
    action: "DEVICE_STATUS_CHANGED",
    status: "OK",
    organizationId: device.organizationId,
    deviceId,
    message: "Device disconnected after missed health checks",
    details: { reason: "health_check_failed" },
  })

  // Email alert — fire-and-forget
  const alertTo = process.env.ALERT_EMAIL
  if (!alertTo) {
    console.error(
      "[whatsapp-health] ALERT_EMAIL not set, skipping disconnect alert"
    )
    return
  }
  const { render } = await import("@react-email/components")
  const { DeviceDisconnectedEmail } = await import(
    "@/modules/whatsapp/emails/device-disconnected"
  )
  const { sendEmail } = await import("@/lib/queue/email")
  const dashboardUrl = process.env.APP_URL ?? "https://app.projects-green.com"
  const html = await render(
    DeviceDisconnectedEmail({
      phoneNumber: device.phoneNumber,
      deviceId,
      dashboardUrl,
    })
  )
  sendEmail({
    to: alertTo,
    subject: `[WhatsApp] Device Disconnected: ${device.phoneNumber}`,
    html,
  }).catch((err: unknown) =>
    console.error(`[whatsapp-health] email failed device=${deviceId}:`, err)
  )
}
