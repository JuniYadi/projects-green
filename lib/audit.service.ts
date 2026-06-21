/**
 * Audit logging service for VPN operations.
 *
 * Fire-and-forget semantics — logs are written asynchronously and
 * never block the main request flow.
 */

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export type AuditAction =
  | "DEVICE_REGISTERED"
  | "DEVICE_REVOKED"
  | "CONFIG_DOWNLOADED"
  | "PROVISIONING_STARTED"
  | "PROVISIONING_SUCCESS"
  | "PROVISIONING_FAILED"
  | "PROVISIONING_RETRIED"
  | "PROVISIONING_STEP"

export type ProvisioningEventDetails =
  | { serverAccountId: string; protocol: string; username: string }
  | { serverAccountId: string; protocol: string }
  | { serverAccountId: string; failureReason: string }
  | { serverAccountId: string; previousFailureReason: string; triggeredByAdminId: string | null }

/**
 * Log a VPN audit event to the database.
 *
 * This function is intentionally fire-and-forget — it swallows errors
 * so that audit logging never blocks or breaks the main request flow.
 */
export async function logAuditEvent(params: {
  deviceId?: string | null
  userId?: string | null
  adminId?: string | null
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
        adminId: params.adminId ?? null,
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

/**
 * Log a VPN provisioning audit event.
 *
 * Fire-and-forget — provisioning must never be blocked by audit logging.
 */
export async function logProvisioningEvent(params: {
  action:
    | "PROVISIONING_STARTED"
    | "PROVISIONING_SUCCESS"
    | "PROVISIONING_FAILED"
    | "PROVISIONING_RETRIED"
  serverAccountId: string
  details?: ProvisioningEventDetails
  adminId?: string | null
}): Promise<void> {
  try {
    await prisma.vpnAuditLog.create({
      data: {
        serverAccountId: params.serverAccountId, // Column, not in details
        adminId: params.adminId ?? null,
        action: params.action,
        details: params.details as Prisma.InputJsonValue,
      },
    })
  } catch {
    // Best-effort — never block provisioning flow
  }
}

/**
 * Log a provisioning step entry (granular step within a provisioning run).
 *
 * Writes a PROVISIONING_STEP entry with step name and status.
 * Fire-and-forget — never blocks provisioning.
 */
export async function logProvisioningStep(params: {
  serverAccountId: string
  step: string
  status: "OK" | "FAILED"
  message?: string
}): Promise<void> {
  try {
    await prisma.vpnAuditLog.create({
      data: {
        serverAccountId: params.serverAccountId,
        action: "PROVISIONING_STEP",
        step: params.step,
        status: params.status,
        details: params.message
          ? ({ message: params.message } as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    })
  } catch {
    // Best-effort — never block provisioning flow
  }
}
