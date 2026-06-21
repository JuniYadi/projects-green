import type { VpnAuditLog } from "@prisma/client"

export type VpnAuditLogDTO = Pick<VpnAuditLog, "id" | "action" | "details" | "createdAt">

export const toAuditLogDTO = (log: VpnAuditLog): VpnAuditLogDTO => ({
  id: log.id,
  action: log.action,
  details: log.details,
  createdAt: log.createdAt,
})
