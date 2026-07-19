import { Prisma, type WhatsappDevice } from "@prisma/client"

import type {
  DeviceDetail,
  DeviceListItem,
  DeviceStatus,
} from "./devices.schemas"

type WhatsappDeviceRecord = WhatsappDevice

const toNumber = (value: Prisma.Decimal | number | string) => Number(value)

const toJsonRecord = (
  value: Prisma.JsonValue | null
): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

/**
 * Map a Prisma WhatsappDevice record to the API response type.
 *
 * NOTE: `name` and `environment` are derived, not stored columns:
 * - The DB model has no `name` column; the `createDeviceSchema` accepts a `name`
 *   field but it is NOT persisted. `phoneNumber` is used as display name.
 * - The DB model has no `environment` column; all devices are treated as LIVE.
 *   The `createDeviceSchema` accepts `environment` (default "LIVE") but it is
 *   NOT persisted.
 */
export type DeviceHealthStatus = "CONNECTED" | "DISCONNECTED" | "UNKNOWN"

export function toDeviceListItem(device: WhatsappDeviceRecord): DeviceListItem {
  const profile =
    device.whatsappProfile &&
    typeof device.whatsappProfile === "object" &&
    !Array.isArray(device.whatsappProfile)
      ? (device.whatsappProfile as Record<string, unknown>)
      : null
  const profileName =
    profile &&
    typeof profile.name === "string" &&
    profile.name.trim().length > 0
      ? profile.name.trim()
      : null

  return {
    id: device.id,
    organizationId: device.organizationId,
    phoneNumber: device.phoneNumber,
    name: profileName ?? device.phoneNumber,
    status: device.status as DeviceStatus,
    environment: "LIVE",
    balance: toNumber(device.balance),
    quotaBase: toNumber(device.quotaBase),
    quotaBaseOut: toNumber(device.quotaBaseOut),
    dailyLimitMessage: device.dailyLimitMessage,
    whatsappBusinessAccountId: device.whatsappBusinessAccountId,
    whatsappPhoneId: device.whatsappPhoneId,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
    lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
    lastDisconnectedAt: device.lastDisconnectedAt?.toISOString() ?? null,
  }
}

export type DeviceHealthInfo = {
  status: DeviceHealthStatus
  lastHeartbeatAt: string | null
  lastDisconnectedAt: string | null
}

export function toDeviceHealthInfo(
  device: WhatsappDeviceRecord
): DeviceHealthInfo {
  const status = device.status as DeviceStatus
  if (status === "DISCONNECTED") {
    return {
      status: "DISCONNECTED",
      lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
      lastDisconnectedAt: device.lastDisconnectedAt?.toISOString() ?? null,
    }
  }
  if (status === "ACTIVE" && device.lastHeartbeatAt) {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
    return {
      status:
        device.lastHeartbeatAt > fifteenMinAgo ? "CONNECTED" : "DISCONNECTED",
      lastHeartbeatAt: device.lastHeartbeatAt.toISOString(),
      lastDisconnectedAt: device.lastDisconnectedAt?.toISOString() ?? null,
    }
  }
  return {
    status: "UNKNOWN",
    lastHeartbeatAt: device.lastHeartbeatAt?.toISOString() ?? null,
    lastDisconnectedAt: device.lastDisconnectedAt?.toISOString() ?? null,
  }
}

export function toDeviceDetail(device: WhatsappDeviceRecord): DeviceDetail {
  return {
    ...toDeviceListItem(device),
    businessId: device.whatsappBusinessAccountId,
    callbackUrl: device.callbackUrl,
    expiredAt: device.expiredAt?.toISOString() ?? null,
    whatsappProfile: toJsonRecord(device.whatsappProfile),
    features: toJsonRecord(device.features),
  }
}
