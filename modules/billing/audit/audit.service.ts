import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export type BillingAuditParams = {
  billingAccountId?: string
  billingRunId?: string
  entityType: string
  entityId: string
  action:
    | "CREATED"
    | "UPDATED"
    | "DELETED"
    | "RUN_STARTED"
    | "RUN_FINISHED"
    | "INVOICE_GENERATED"
    | "PAYMENT_CONFIRMED"
    | "ORDER_CREATED"
    | "BALANCE_ADJUSTED"
    | "TOPUP_PERFORMED"
    | "SUBSCRIPTION_ACTIVATED"
    | "SUBSCRIPTION_CANCELLED"
    | "CONTACT_ADDED"
    | "CONTACT_REMOVED"
    | "SETTINGS_CHANGED"
  actorId?: string
  context?: Record<string, unknown>
}
/**
 * Log a billing audit event to the database.
 * Fire-and-forget — never blocks the main request flow.
 */
export async function logBillingAuditEvent(
  params: BillingAuditParams
): Promise<void> {
  try {
    await prisma.billingAuditLog.create({
      data: {
        billingAccountId: params.billingAccountId ?? null,
        billingRunId: params.billingRunId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        actorType: "USER",
        actorId: params.actorId ?? null,
        contextJson: (params.context ?? null) as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    console.error("[BillingAudit] Failed to log audit event:", err)
  }
}

/**
 * Fire-and-forget convenience wrapper.
 */
export function emitBillingAudit(params: BillingAuditParams): void {
  void logBillingAuditEvent(params)
}
