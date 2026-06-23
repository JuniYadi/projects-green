import { Prisma } from "@prisma/client"

export type WhatsappAuditLogDTO = {
  id: string
  organizationId: string
  deviceId: string | null
  adminId: string | null
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

export function toWhatsappAuditLogDTO(
  log: Prisma.WhatsappAuditLogGetPayload<{}>
): WhatsappAuditLogDTO {
  return {
    id: log.id,
    organizationId: log.organizationId,
    deviceId: log.deviceId,
    adminId: log.adminId,
    correlationId: log.correlationId,
    action: log.action,
    status: log.status,
    message: log.message,
    errorMessage: log.errorMessage,
    details: log.details as Record<string, unknown> | null,
    durationMs: log.durationMs,
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }
}
