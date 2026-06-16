/**
 * Audit logging service for VPN mobile operations.
 *
 * Fire-and-forget semantics — logs are written asynchronously and
 * never block the main request flow.
 */

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export type AuditAction = "DEVICE_REGISTERED" | "DEVICE_REVOKED" | "CONFIG_DOWNLOADED"

/**
 * Log a VPN audit event to the database.
 *
 * This function is intentionally fire-and-forget — it swallows errors
 * so that audit logging never blocks or breaks the main request flow.
 */
export async function logAuditEvent(params: {
  deviceId?: string | null
  userId?: string | null
  action: AuditAction
  details?: Record<string, unknown>
  ip?: string | null
  userAgent?: string | null
}): Promise<void> {
  try {
    await prisma.vpnAuditLog.create({
      data: {
        deviceId: params.deviceId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        details: params.details as Prisma.InputJsonValue,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
  } catch {
    // Best-effort — never block the main request flow
  }
}
