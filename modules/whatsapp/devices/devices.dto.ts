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

export function toDeviceListItem(device: WhatsappDeviceRecord): DeviceListItem {
  return {
    id: device.id,
    organizationId: device.organizationId,
    phoneNumber: device.phoneNumber,
    name: device.phoneNumber,
    status: device.status as DeviceStatus,
    environment: "LIVE",
    balance: toNumber(device.balance),
    quotaBase: toNumber(device.quotaBase),
    dailyLimitMessage: device.dailyLimitMessage,
    whatsappBusinessAccountId: device.whatsappBusinessAccountId,
    whatsappPhoneId: device.whatsappPhoneId,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
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
