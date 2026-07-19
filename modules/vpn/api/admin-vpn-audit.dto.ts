import type { VpnAuditLog } from "@prisma/client"

/**
 * Lean DTO for the per-account provisioning modal.
 * Includes new columns most relevant to a single account's history.
 */
export type VpnAuditLogDTO = Pick<
  VpnAuditLog,
  | "id"
  | "action"
  | "status"
  | "message"
  | "errorMessage"
  | "step"
  | "details"
  | "durationMs"
  | "createdAt"
>

export const toAuditLogDTO = (log: VpnAuditLog): VpnAuditLogDTO => ({
  id: log.id,
  action: log.action,
  status: log.status,
  message: log.message,
  errorMessage: log.errorMessage,
  step: log.step,
  details: log.details,
  durationMs: log.durationMs,
  createdAt: log.createdAt,
})

/**
 * Rich DTO for the global audit log list page.
 * Exposes all linkage columns for filtering and display.
 */
export type VpnAuditLogListDTO = Pick<
  VpnAuditLog,
  | "id"
  | "organizationId"
  | "subscriptionId"
  | "serverAccountId"
  | "serverId"
  | "correlationId"
  | "deviceId"
  | "userId"
  | "adminId"
  | "action"
  | "status"
  | "step"
  | "message"
  | "errorMessage"
  | "details"
  | "requestPayload"
  | "responsePayload"
  | "durationMs"
  | "ip"
  | "userAgent"
  | "createdAt"
>

export const toAuditLogListDTO = (log: VpnAuditLog): VpnAuditLogListDTO => ({
  id: log.id,
  organizationId: log.organizationId,
  subscriptionId: log.subscriptionId,
  serverAccountId: log.serverAccountId,
  serverId: log.serverId,
  correlationId: log.correlationId,
  deviceId: log.deviceId,
  userId: log.userId,
  adminId: log.adminId,
  action: log.action,
  status: log.status,
  step: log.step,
  message: log.message,
  errorMessage: log.errorMessage,
  details: log.details,
  requestPayload: log.requestPayload,
  responsePayload: log.responsePayload,
  durationMs: log.durationMs,
  ip: log.ip,
  userAgent: log.userAgent,
  createdAt: log.createdAt,
})
