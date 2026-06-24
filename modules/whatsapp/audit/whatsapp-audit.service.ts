import { prisma } from "@/lib/prisma"

export type WhatsappAuditAction =
  // Template
  | "TEMPLATE_SYNC_STARTED"
  | "TEMPLATE_SYNC_REQUESTED"
  | "TEMPLATE_SYNCED"
  | "TEMPLATE_SYNC_FAILED"
  | "TEMPLATE_CREATED"
  | "TEMPLATE_CREATE_FAILED"
  | "TEMPLATE_UPDATED"
  | "TEMPLATE_UPDATE_FAILED"
  | "TEMPLATE_DELETED"
  // Device
  | "DEVICE_INFO_UPDATED"
  | "DEVICE_STATUS_CHANGED"
  | "DEVICE_CALLBACK_URL_UPDATED"
  // Broadcast / Message
  | "BROADCAST_SENT"
  | "BROADCAST_FAILED"
  | "BROADCAST_CANCELLED"
  | "MESSAGE_SENT"
  | "MESSAGE_DELIVERED"
  | "MESSAGE_READ"
  | "MESSAGE_FAILED"
  // Contact / Group
  | "CONTACT_IMPORTED"
  | "CONTACT_GROUP_CREATED"
  | "CONTACT_GROUP_UPDATED"
  // Webhook (outgoing — system to user)
  | "WEBHOOK_SENT"
  | "WEBHOOK_DELIVERED"
  | "WEBHOOK_FAILED"
  | "WEBHOOK_RETRIED"
  // Admin
  | "ADMIN_LOGIN"

export type WhatsappAuditEventStatus = "OK" | "FAILED" | "STARTED" | "PENDING"

export type WhatsappAuditEventParams = {
  action: WhatsappAuditAction
  status?: WhatsappAuditEventStatus
  organizationId: string
  deviceId?: string | null
  adminId?: string | null
  correlationId?: string | null
  message?: string | null
  errorMessage?: string | null
  details?: Record<string, unknown> | null
  durationMs?: number | null
  ip?: string | null
  userAgent?: string | null
}

export async function logWhatsappAuditEvent(
  params: WhatsappAuditEventParams
): Promise<void> {
  try {
    await prisma.whatsappAuditLog.create({
      data: {
        organizationId: params.organizationId,
        deviceId: params.deviceId ?? null,
        adminId: params.adminId ?? null,
        correlationId: params.correlationId ?? null,
        action: params.action,
        status: params.status ?? null,
        message: params.message ?? null,
        errorMessage: params.errorMessage ?? null,
        details: (params.details as any) ?? null,
        durationMs: params.durationMs ?? null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
  } catch (err) {
    // fire-and-forget — never block the caller
    console.error("[WhatsappAudit] Failed to create audit entry:", err)
  }
}
