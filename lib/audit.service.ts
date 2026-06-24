/**
 * Audit logging service for VPN operations.
 *
 * Fire-and-forget semantics — logs are written asynchronously and
 * never block the main request flow.
 */

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

export type AuditAction =
  // ── Device lifecycle ──
  | "DEVICE_REGISTERED"
  | "DEVICE_REVOKED"
  | "DEVICE_RENAMED"
  | "DEVICE_HEARTBEAT"
  | "DEVICE_EXPORTED"

  // ── Provisioning lifecycle ──
  | "PROVISIONING_STARTED"
  | "PROVISIONING_STEP"
  | "PROVISIONING_SUCCESS"
  | "PROVISIONING_FAILED"
  | "PROVISIONING_RETRIED"
  | "PROVISIONING_RECREATE_REQUESTED"

  // ── Remote account ──
  | "REMOTE_ACCOUNT_VALIDATED"
  | "REMOTE_ACCOUNT_MISSING"
  | "REMOTE_ACCOUNT_REMOVED"

  // ── Config access ──
  | "CONFIG_DOWNLOADED"
  | "CONFIG_VIEWED_BY_ADMIN"

  // ── Subscription lifecycle ──
  | "SUBSCRIPTION_CREATED"
  | "SUBSCRIPTION_ACTIVATED"
  | "SUBSCRIPTION_CANCELLED"
  | "SUBSCRIPTION_REINSTATED"
  | "SUBSCRIPTION_RENEWED"
  | "SUBSCRIPTION_RENEWAL_FAILED"
  | "SUBSCRIPTION_EXPIRED"
  | "SUBSCRIPTION_SUSPENDED"

  // ── Admin operations ──
  | "ADMIN_RETRY_ALL"
  | "ADMIN_REVOKE_REQUESTED"
  | "RECONCILIATION_RAN"

  // ── Auth ──
  | "AUTH_TOKEN_EXCHANGED"

  // ── Sync Protocols ──
  | "SYNC_PROTOCOLS_REQUESTED"
  | "SYNC_PROTOCOLS_STARTED"
  | "SYNC_PROTOCOLS_ACCOUNT_CREATED"
  | "SYNC_PROTOCOLS_ACCOUNT_SKIPPED"
  | "SYNC_PROTOCOLS_COMPLETED"
  | "SYNC_PROTOCOLS_FAILED"

  // ── System ──
  | "RATE_LIMIT_HIT"

export type AuditEventStatus = "OK" | "FAILED" | "STARTED" | "PENDING"

export type AuditEventParams = {
  // Linkage — at least one should be set
  organizationId?: string | null
  subscriptionId?: string | null
  serverAccountId?: string | null
  serverId?: string | null
  deviceId?: string | null
  userId?: string | null
  adminId?: string | null

  // Correlation
  correlationId?: string | null

  // Event
  action: AuditAction
  status?: AuditEventStatus | null
  step?: string | null
  /** Required human-readable one-line summary */
  message: string

  // Debug
  errorMessage?: string | null
  requestPayload?: Record<string, unknown> | null
  responsePayload?: Record<string, unknown> | null
  details?: Record<string, unknown> | null
  durationMs?: number | null

  // Network
  ip?: string | null
  userAgent?: string | null
}

/**
 * Log a VPN audit event to the database.
 *
 * Fire-and-forget — never blocks the main request flow.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await prisma.vpnAuditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        subscriptionId: params.subscriptionId ?? null,
        serverAccountId: params.serverAccountId ?? null,
        serverId: params.serverId ?? null,
        correlationId: params.correlationId ?? null,
        deviceId: params.deviceId ?? null,
        userId: params.userId ?? null,
        adminId: params.adminId ?? null,
        action: params.action,
        status: params.status ?? null,
        step: params.step ?? null,
        message: params.message,
        errorMessage: params.errorMessage ?? null,
        requestPayload: params.requestPayload as Prisma.InputJsonValue ?? Prisma.JsonNull,
        responsePayload: params.responsePayload as Prisma.InputJsonValue ?? Prisma.JsonNull,
        details: params.details as Prisma.InputJsonValue ?? Prisma.JsonNull,
        durationMs: params.durationMs ?? null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
  } catch {
    // Best-effort — never block the main request flow
  }
}
