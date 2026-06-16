import type { Prisma } from "@prisma/client"

// Prisma's GetPayload requires a default-args generic. The empty object is
// the documented way to get the bare model payload (AGENTS.md DTO pattern).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type DevicePayload = Prisma.VpnMobileDeviceGetPayload<{}>

/**
 * VpnMobileDevice DTO — boundary contract for API responses.
 *
 * Derived from the generated Prisma payload via Pick<...> — never manual
 * model types (per AGENTS.md hard requirement).
 */
export type VpnMobileDeviceDTO = Pick<
  DevicePayload,
  | "id"
  | "organizationId"
  | "subscriptionId"
  | "userId"
  | "deviceName"
  | "deviceFingerprint"
  | "platform"
  | "osVersion"
  | "appVersion"
  | "pairedVia"
  | "status"
  | "lastSeenAt"
  | "revokedAt"
  | "revokedReason"
  | "revokedBy"
  | "createdAt"
  | "updatedAt"
>

export type VpnMobileDeviceListDTO = VpnMobileDeviceDTO[]

type MobileDeviceRow = DevicePayload

/**
 * Map a Prisma VpnMobileDevice row to its API-safe DTO.
 */
export function toMobileDeviceDTO(
  row: MobileDeviceRow
): VpnMobileDeviceDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    subscriptionId: row.subscriptionId,
    userId: row.userId,
    deviceName: row.deviceName,
    deviceFingerprint: row.deviceFingerprint,
    platform: row.platform,
    osVersion: row.osVersion,
    appVersion: row.appVersion,
    pairedVia: row.pairedVia,
    status: row.status,
    lastSeenAt: row.lastSeenAt,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
    revokedBy: row.revokedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Map a list of Prisma VpnMobileDevice rows to DTOs.
 */
export function toMobileDeviceListDTO(
  rows: MobileDeviceRow[]
): VpnMobileDeviceListDTO {
  return rows.map(toMobileDeviceDTO)
}
