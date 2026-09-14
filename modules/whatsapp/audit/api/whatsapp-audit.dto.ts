import type { WhatsappAuditLog } from "@prisma/client"

export type WhatsappAuditLogDTO = {
  id: string
  organizationId: string
  deviceId: string | null
  deviceLabel?: string | null
  phoneNumber?: string | null
  adminId: string | null
  actorName?: string | null
  actorEmail?: string | null
  isPlatformAdmin?: boolean
  correlationId: string | null
  action: string
  status: string | null
  message: string | null
  errorMessage: string | null
  details: Record<string, unknown> | null
  durationMs: number | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

type AuditLogWithExtras = WhatsappAuditLog & {
  deviceLabel?: string | null
  actorName?: string | null
  actorEmail?: string | null
  isPlatformAdmin?: boolean
}

export function toWhatsappAuditLogDTO(
  log: AuditLogWithExtras
): WhatsappAuditLogDTO {
  const detailsObj =
    log.details && typeof log.details === "object"
      ? (log.details as Record<string, unknown>)
      : null
  const phoneFromDetails =
    detailsObj && typeof detailsObj.phoneNumber === "string"
      ? detailsObj.phoneNumber
      : null

  return {
    id: log.id,
    organizationId: log.organizationId,
    deviceId: log.deviceId,
    deviceLabel: log.deviceLabel ?? log.deviceId,
    phoneNumber: phoneFromDetails,
    adminId: log.adminId,
    actorName: log.actorName ?? (log.adminId ? log.adminId.slice(0, 10) : null),
    actorEmail: log.actorEmail ?? null,
    isPlatformAdmin: Boolean(log.isPlatformAdmin),
    correlationId: log.correlationId,
    action: log.action,
    status: log.status,
    message: log.message,
    errorMessage: log.errorMessage,
    details: detailsObj,
    durationMs: log.durationMs,
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }
}
