import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { enqueueOutgoingWebhook } from "@/lib/queue/whatsapp-webhook-outgoing"

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type WebhookDeliveryLogDTO = Pick<
  Prisma.WhatsappWebhookDeliveryLogGetPayload<{}>,
  | "id"
  | "webhookId"
  | "organizationId"
  | "whatsappDeviceId"
  | "eventType"
  | "triggerEventId"
  | "status"
  | "attempt"
  | "maxAttempts"
  | "responseStatus"
  | "errorMessage"
  | "resolvedAt"
  | "startedAt"
  | "completedAt"
  | "createdAt"
>

export type WebhookDeliveryLogDetailDTO = Prisma.WhatsappWebhookDeliveryLogGetPayload<{}>

export function toDeliveryLogDTO(
  log: Prisma.WhatsappWebhookDeliveryLogGetPayload<{}>
): WebhookDeliveryLogDTO {
  return {
    id: log.id,
    webhookId: log.webhookId,
    organizationId: log.organizationId,
    whatsappDeviceId: log.whatsappDeviceId,
    eventType: log.eventType,
    triggerEventId: log.triggerEventId,
    status: log.status,
    attempt: log.attempt,
    maxAttempts: log.maxAttempts,
    responseStatus: log.responseStatus,
    errorMessage: log.errorMessage,
    resolvedAt: log.resolvedAt,
    startedAt: log.startedAt,
    completedAt: log.completedAt,
    createdAt: log.createdAt,
  }
}

// ─── Pagination Types ─────────────────────────────────────────────────────────

export type PaginatedResult<T> = {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// ─── Delivery Log Filters ─────────────────────────────────────────────────────

export type DeliveryLogFilters = {
  webhookId?: string
  eventType?: string
  status?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const webhookDispatcher = {
  /**
   * Dispatch a webhook event to a single webhook URL.
   */
  async dispatch(
    webhookId: string,
    eventType: string,
    payload: unknown,
    triggerEventId?: string
  ): Promise<void> {
    const webhook = await prisma.whatsappWebhook.findUnique({
      where: { id: webhookId },
      select: { organizationId: true, whatsappDeviceId: true },
    })

    if (!webhook) {
      console.warn(
        `[webhook-dispatcher] webhook not found: ${webhookId}, skipping dispatch`
      )
      return
    }

    await enqueueOutgoingWebhook({
      webhookId,
      organizationId: webhook.organizationId,
      deviceId: webhook.whatsappDeviceId,
      eventType,
      eventId: triggerEventId,
      payload,
    })
  },

  /**
   * Dispatch a webhook event to all ACTIVE webhooks for a device.
   * Fire-and-forget — never blocks the caller.
   */
  async dispatchForDevice(
    deviceId: string,
    eventType: string,
    payload: unknown,
    triggerEventId?: string
  ): Promise<void> {
    const webhooks = await prisma.whatsappWebhook.findMany({
      where: { whatsappDeviceId: deviceId, active: true },
    })

    if (webhooks.length === 0) return

    await Promise.all(
      webhooks.map((w) =>
        enqueueOutgoingWebhook({
          webhookId: w.id,
          organizationId: w.organizationId,
          deviceId,
          eventType,
          eventId: triggerEventId,
          payload,
        })
      )
    )
  },

  /**
   * Get paginated delivery logs for a webhook.
   */
  async getDeliveryLogs(
    webhookId: string,
    filters: DeliveryLogFilters
  ): Promise<PaginatedResult<WebhookDeliveryLogDTO>> {
    const { eventType, status, from, to, page = 1, limit = 20 } = filters

    const where: Prisma.WhatsappWebhookDeliveryLogWhereInput = { webhookId }

    if (eventType) where.eventType = eventType
    if (status) where.status = status as any
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) where.createdAt.lte = new Date(to)
    }

    const skip = (page - 1) * limit

    const [total, logs] = await Promise.all([
      prisma.whatsappWebhookDeliveryLog.count({ where }),
      prisma.whatsappWebhookDeliveryLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ])

    return {
      data: logs.map(toDeliveryLogDTO),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }
  },

  /**
   * Resend a failed or dead-lettered delivery.
   */
  async resendDelivery(deliveryLogId: string): Promise<void> {
    const deliveryLog =
      await prisma.whatsappWebhookDeliveryLog.findUnique({
        where: { id: deliveryLogId },
      })

    if (!deliveryLog) {
      throw new Error(`Delivery log not found: ${deliveryLogId}`)
    }

    if (deliveryLog.status === "SUCCESS") {
      throw new Error("Cannot resend a successful delivery")
    }

    // Reset and re-enqueue
    await prisma.whatsappWebhookDeliveryLog.update({
      where: { id: deliveryLogId },
      data: {
        status: "PENDING",
        attempt: 0,
        errorMessage: null,
        completedAt: null,
        resolvedAt: new Date(),
      },
    })

    await enqueueOutgoingWebhook({
      webhookId: deliveryLog.webhookId,
      organizationId: deliveryLog.organizationId,
      deviceId: deliveryLog.whatsappDeviceId,
      eventType: deliveryLog.eventType,
      eventId: deliveryLog.triggerEventId ?? undefined,
      payload: deliveryLog.requestBody,
    })
  },
}
