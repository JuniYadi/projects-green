import type { Prisma } from "@prisma/client"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type SessionPayload = Prisma.VpnMobileSessionGetPayload<{}>
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type DevicePayload = Prisma.VpnMobileDeviceGetPayload<{}>

export type VpnMobileSessionDTO = {
  id: string
  deviceId: string
  subscriptionId: string
  serverAccountId: string
  serverId: string
  status: string
  startedAt: Date
  lastPingAt: Date
  endedAt: Date | null
  txBytes: number
  rxBytes: number
}

export type VpnMobileSessionDetailDTO = VpnMobileSessionDTO & {
  deviceName: string
  serverName: string
  region: string | null
  protocol: string
}

export type VpnMobileSessionListDTO = {
  sessions: VpnMobileSessionDetailDTO[]
  nextCursor: string | null
  total: number
}

export type VpnMobileSessionStatsDTO = {
  totalActive: number
  byServer: Record<string, number>
  bySubscription: Record<string, number>
}

type SessionRow = SessionPayload
type DeviceRow = DevicePayload

export function toSessionDTO(row: SessionRow): VpnMobileSessionDTO {
  return {
    id: row.id,
    deviceId: row.deviceId,
    subscriptionId: row.subscriptionId,
    serverAccountId: row.serverAccountId,
    serverId: row.serverId,
    status: row.status,
    startedAt: row.startedAt,
    lastPingAt: row.lastPingAt,
    endedAt: row.endedAt,
    txBytes: Number(row.txBytes),
    rxBytes: Number(row.rxBytes),
  }
}

export function toSessionDetailDTO(
  row: SessionRow & {
    device?: Pick<DeviceRow, "deviceName">
    server?: { name: string; region?: { name: string } | null } | null
    serverAccount?: { protocol: string } | null
  }
): VpnMobileSessionDetailDTO {
  return {
    ...toSessionDTO(row),
    deviceName: row.device?.deviceName ?? "Unknown",
    serverName: row.server?.name ?? "Unknown",
    region: row.server?.region?.name ?? null,
    protocol: row.serverAccount?.protocol ?? "UNKNOWN",
  }
}
