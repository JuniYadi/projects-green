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
          token: input.token ?? null,
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
            token: input.token ?? undefined,
            quotaBase: input.quotaBase ?? undefined,
            dailyLimitMessage: input.dailyLimitMessage ?? undefined,
            callbackUrl: input.callbackUrl || undefined,
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

      const updated = await db.whatsappDevice.update({
        where: { id },
        data: { status: "ACTIVE" },
      })
      return _toDeviceDetail(updated as PrismaDeviceFields)
    },
  }
}
