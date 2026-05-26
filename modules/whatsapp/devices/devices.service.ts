/**
 * WhatsApp Devices — Service layer
 * Org-scoped CRUD operations via Prisma.
 *
 * NOTE: The Prisma model (WhatsappDevice) does NOT yet have an
 * `environment` column. `environment` (SANDBOX/LIVE) is accepted on
 * create/update but not persisted - add that column in a follow-up migration.
 */

import { prisma } from "@/lib/prisma"

import {
  type DeviceService,
  type DeviceDetail,
  type DeviceListItem,
  type CreateDeviceInput,
  type UpdateDeviceInput,
  type DeviceStatus,
  type DeviceEnvironment,
  DeviceNotFoundError,
  DeviceNotOwnedError,
} from "./devices.schemas"

// ─── Mappers ──────────────────────────────────────────────────────────────────

const toDeviceListItem = (d: {
  id: string
  organizationId: string
  phoneNumber: string
  name: string
  status: DeviceStatus
  balance: unknown
  quotaBase: unknown
  dailyLimitMessage: number
  whatsappBusinessAccountId: string | null
  whatsappPhoneId: string | null
  createdAt: Date
  updatedAt: Date
  environment?: string
}): DeviceListItem => ({
  id: d.id,
  organizationId: d.organizationId,
  phoneNumber: d.phoneNumber,
  name: d.name,
  status: d.status,
  environment: (d.environment as DeviceEnvironment) ?? "LIVE",
  balance: Number(d.balance),
  quotaBase: Number(d.quotaBase),
  dailyLimitMessage: d.dailyLimitMessage,
  whatsappBusinessAccountId: d.whatsappBusinessAccountId,
  whatsappPhoneId: d.whatsappPhoneId,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
})

const _toDeviceDetail = (d: {
  id: string
  organizationId: string
  phoneNumber: string
  name: string
  status: DeviceStatus
  balance: unknown
  quotaBase: unknown
  dailyLimitMessage: number
  whatsappBusinessAccountId: string | null
  whatsappPhoneId: string | null
  createdAt: Date
  updatedAt: Date
  environment?: string
  businessId?: string | null
  callbackUrl?: string | null
  expiredAt?: Date | null
  whatsappProfile?: Record<string, unknown> | null
  features?: Record<string, unknown> | null
}): DeviceDetail => ({
  ...toDeviceListItem(d),
  businessId: d.businessId ?? null,
  callbackUrl: d.callbackUrl ?? null,
  expiredAt: d.expiredAt?.toISOString() ?? null,
  whatsappProfile: d.whatsappProfile ?? null,
  features: d.features ?? null,
})

// ─── Factory ──────────────────────────────────────────────────────────────────

export const createDeviceService = (options: { prisma?: typeof prisma } = {}): DeviceService => {
  const db = options.prisma ?? prisma

  return {
    async listByOrganization(organizationId) {
      const devices = await db.whatsappDevice.findMany({
        where: organizationId ? { organizationId } : {},
        orderBy: { createdAt: "desc" },
      })
      return devices.map(toDeviceListItem)
    },

    async findById(id, organizationId) {
      const device = await db.whatsappDevice.findUnique({ where: { id } })
      if (!device) throw new DeviceNotFoundError(id)
      if (organizationId && device.organizationId !== organizationId) {
        throw new DeviceNotOwnedError()
      }
      return _toDeviceDetail(device)
    },

    async create(input) {
      const device = await db.whatsappDevice.create({
        data: {
          organizationId: input.organizationId ?? "",
          name: input.name,
          phoneNumber: input.phoneNumber,
          status: "ACTIVE",
          // environment: not yet persisted; add column in follow-up
        },
      })
      return _toDeviceDetail(device)
    },

    async update(id, input, _organizationId) {
      const existing = await db.whatsappDevice.findUnique({ where: { id } })
      if (!existing) throw new DeviceNotFoundError(id)

      const updated = await db.whatsappDevice.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phoneNumber !== undefined ? { phoneNumber: input.phoneNumber } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.token !== undefined ? { token: input.token } : {}),
          ...(input.quotaBase !== undefined ? { quotaBase: input.quotaBase } : {}),
          ...(input.dailyLimitMessage !== undefined ? { dailyLimitMessage: input.dailyLimitMessage } : {}),
          ...(input.callbackUrl !== undefined ? { callbackUrl: input.callbackUrl || null } : {}),
        },
      })
      return _toDeviceDetail(updated)
    },

    async delete(id) {
      await db.whatsappDevice.delete({ where: { id } })
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
      return _toDeviceDetail(updated)
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
      return _toDeviceDetail(updated)
    },
  }
}