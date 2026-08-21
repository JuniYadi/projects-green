import { Prisma } from "@prisma/client"

/**
 * Webhook event DTO for list responses — excludes metaPayload
 * to keep list payloads small.
 */
export type WhatsappWebhookEventDTO = {
  id: string
  organizationId: string
  whatsappDeviceId: string
  eventType: string
  processingStatus: string
  waMessageId: string | null
  phoneNumber?: string | null
  deliveryStatus?: string | null
  deviceLabel?: string | null
  errorMessage: string | null
  processedAt: Date | null
  createdAt: Date
  metaPayload?: Record<string, unknown> | null
}

/**
 * Webhook event detail DTO — includes metaPayload for single-event views.
 */
export type WhatsappWebhookEventDetailDTO = WhatsappWebhookEventDTO

function extractEventMetadata(
  payload: unknown,
  eventType: string
): {
  waMessageId: string | null
  phoneNumber: string | null
  deliveryStatus: string | null
} {
  if (!payload || typeof payload !== "object") {
    return { waMessageId: null, phoneNumber: null, deliveryStatus: null }
  }

  const p = payload as Record<string, unknown>

  // Case 1: Status payload directly (e.g. { id, status, recipient_id })
  if (eventType === "status_update") {
    const statusStr =
      typeof p.status === "string" ? p.status.toUpperCase() : null
    const recipientId =
      typeof p.recipient_id === "string" ? p.recipient_id : null
    const id = typeof p.id === "string" ? p.id : null
    return {
      waMessageId: id,
      phoneNumber: recipientId,
      deliveryStatus: statusStr,
    }
  }

  // Case 2: Inbound message payload directly (e.g. { id, from, type })
  if (eventType === "inbound_message") {
    const from = typeof p.from === "string" ? p.from : null
    const id = typeof p.id === "string" ? p.id : null
    return {
      waMessageId: id,
      phoneNumber: from,
      deliveryStatus: "RECEIVED",
    }
  }

  return { waMessageId: null, phoneNumber: null, deliveryStatus: null }
}

type WhatsappWebhookEventWithDevice =
  Prisma.WhatsappWebhookEventGetPayload<Prisma.WhatsappWebhookEventDefaultArgs> & {
    whatsappDevice?: {
      phoneNumber: string
    } | null
  }

export function toWebhookEventDTO(
  event: WhatsappWebhookEventWithDevice
): WhatsappWebhookEventDTO {
  const extracted = extractEventMetadata(event.metaPayload, event.eventType)
  const device = event.whatsappDevice
  const deviceLabel = device?.phoneNumber ?? null

  return {
    id: event.id,
    organizationId: event.organizationId,
    whatsappDeviceId: event.whatsappDeviceId,
    eventType: event.eventType,
    processingStatus: event.processingStatus,
    waMessageId: event.waMessageId ?? extracted.waMessageId,
    phoneNumber: extracted.phoneNumber,
    deliveryStatus: extracted.deliveryStatus ?? event.processingStatus,
    deviceLabel,
    errorMessage: event.errorMessage,
    processedAt: event.processedAt,
    createdAt: event.createdAt,
    metaPayload:
      event.metaPayload && typeof event.metaPayload === "object"
        ? (event.metaPayload as Record<string, unknown>)
        : null,
  }
}

export function toWebhookEventDetailDTO(
  event: WhatsappWebhookEventWithDevice
): WhatsappWebhookEventDetailDTO {
  return toWebhookEventDTO(event)
}
