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
  messageBody?: string | null
  deviceLabel?: string | null
  deviceName?: string | null
  devicePhone?: string | null
  errorMessage: string | null
  processedAt: Date | null
  createdAt: Date
  metaPayload?: Record<string, unknown> | null
}
/**
 * Webhook event detail DTO — includes metaPayload for single-event views.
 */
export type WhatsappWebhookEventDetailDTO = WhatsappWebhookEventDTO

export function extractEventMetadata(
  payload: unknown,
  eventType: string
): {
  waMessageId: string | null
  phoneNumber: string | null
  deliveryStatus: string | null
  messageBody?: string | null
} {
  if (!payload || typeof payload !== "object") {
    return {
      waMessageId: null,
      phoneNumber: null,
      deliveryStatus: null,
      messageBody: null,
    }
  }

  let p = payload as Record<string, unknown>

  // Normalize Meta envelope: { entry: [{ changes: [{ value: { messages, statuses } }] }] }
  if ("entry" in p && Array.isArray(p.entry)) {
    const entry = p.entry as Record<string, unknown>[]
    const changes = entry[0]?.changes as Record<string, unknown>[] | undefined
    const value = changes?.[0]?.value as Record<string, unknown> | undefined
    if (value && typeof value === "object") {
      if (
        eventType === "inbound_message" &&
        Array.isArray(value.messages) &&
        value.messages.length > 0 &&
        typeof value.messages[0] === "object" &&
        value.messages[0] !== null
      ) {
        p = value.messages[0] as Record<string, unknown>
      } else if (
        eventType === "status_update" &&
        Array.isArray(value.statuses) &&
        value.statuses.length > 0 &&
        typeof value.statuses[0] === "object" &&
        value.statuses[0] !== null
      ) {
        p = value.statuses[0] as Record<string, unknown>
      }
    }
  }

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
      messageBody: null,
    }
  }

  // Case 2: Inbound message payload directly (e.g. { id, from, type, text })
  if (eventType === "inbound_message") {
    const from = typeof p.from === "string" ? p.from : null
    const id = typeof p.id === "string" ? p.id : null
    const textObj = p.text as { body?: string } | undefined
    const body =
      typeof textObj?.body === "string"
        ? textObj.body
        : typeof p.body === "string"
          ? p.body
          : null
    return {
      waMessageId: id,
      phoneNumber: from,
      deliveryStatus: "RECEIVED",
      messageBody: body,
    }
  }

  return {
    waMessageId: null,
    phoneNumber: null,
    deliveryStatus: null,
    messageBody: null,
  }
}
type WhatsappWebhookEventWithDevice =
  Prisma.WhatsappWebhookEventGetPayload<Prisma.WhatsappWebhookEventDefaultArgs> & {
    whatsappDevice?: {
      phoneNumber: string
      whatsappProfile?: Prisma.JsonValue | null
    } | null
  }

export function toWebhookEventDTO(
  event: WhatsappWebhookEventWithDevice
): WhatsappWebhookEventDTO {
  const extracted = extractEventMetadata(event.metaPayload, event.eventType)
  const device = event.whatsappDevice
  const devicePhone = device?.phoneNumber ?? null
  const profile =
    device?.whatsappProfile &&
    typeof device.whatsappProfile === "object" &&
    !Array.isArray(device.whatsappProfile)
      ? (device.whatsappProfile as Record<string, unknown>)
      : null
  const deviceName =
    (profile &&
    typeof profile.name === "string" &&
    profile.name.trim().length > 0
      ? profile.name.trim()
      : null) ||
    (profile &&
    typeof profile.verified_name === "string" &&
    profile.verified_name.trim().length > 0
      ? profile.verified_name.trim()
      : null) ||
    devicePhone ||
    event.whatsappDeviceId

  return {
    id: event.id,
    organizationId: event.organizationId,
    whatsappDeviceId: event.whatsappDeviceId,
    eventType: event.eventType,
    processingStatus: event.processingStatus,
    waMessageId: event.waMessageId ?? extracted.waMessageId,
    phoneNumber: extracted.phoneNumber,
    deliveryStatus: extracted.deliveryStatus ?? event.processingStatus,
    messageBody: extracted.messageBody ?? null,
    deviceLabel: devicePhone ?? event.whatsappDeviceId,
    deviceName,
    devicePhone,
    errorMessage: event.errorMessage ?? null,
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
