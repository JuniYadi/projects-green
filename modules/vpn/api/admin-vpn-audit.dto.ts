import type { VpnAuditLog } from "@prisma/client"

/**
 * Lean DTO for the per-account provisioning modal.
 * Kept for backwards compatibility with `/admin/vpn/audit/accounts/:saId`.
 */
export type VpnAuditLogDTO = Pick<
  VpnAuditLog,
  "id" | "action" | "details" | "createdAt"
>

export const toAuditLogDTO = (log: VpnAuditLog): VpnAuditLogDTO => ({
  id: log.id,
  action: log.action,
  details: log.details,
  createdAt: log.createdAt,
})

/**
 * Richer DTO for the global audit log list page (`/portal/vpn/audit-logs`).
 * Exposes every list-friendly field while staying derived from the generated
 * Prisma model — never duplicate the model manually.
 *
 * `details` is returned as-is (Prisma already types it as `Prisma.JsonValue`).
 * The UI layer is responsible for semantic extraction and pretty-printing.
 */
export type VpnAuditLogListDTO = Pick<
  VpnAuditLog,
  | "id"
  | "serverAccountId"
  | "deviceId"
  | "userId"
  | "adminId"
  | "action"
  | "step"
  | "status"
  | "details"
  | "ip"
  | "userAgent"
  | "createdAt"
>

export const toAuditLogListDTO = (
  log: VpnAuditLog
): VpnAuditLogListDTO => ({
  id: log.id,
  serverAccountId: log.serverAccountId,
  deviceId: log.deviceId,
  userId: log.userId,
  adminId: log.adminId,
  action: log.action,
  step: log.step,
  status: log.status,
  details: log.details,
  ip: log.ip,
  userAgent: log.userAgent,
  createdAt: log.createdAt,
})
