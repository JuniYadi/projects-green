import { Prisma } from "@prisma/client"

/**
 * Webhook event DTO for list responses — excludes metaPayload
 * to keep list payloads small.
 */
export type WhatsappWebhookEventDTO = Pick<
  Prisma.WhatsappWebhookEventGetPayload<Prisma.WhatsappWebhookEventDefaultArgs>,
  | "id"
  | "organizationId"
  | "whatsappDeviceId"
  | "eventType"
  | "processingStatus"
  | "waMessageId"
  | "errorMessage"
  | "processedAt"
  | "createdAt"
>

/**
 * Webhook event detail DTO — includes metaPayload for single-event views.
 */
export type WhatsappWebhookEventDetailDTO = Pick<
  Prisma.WhatsappWebhookEventGetPayload<Prisma.WhatsappWebhookEventDefaultArgs>,
  | "id"
  | "organizationId"
  | "whatsappDeviceId"
  | "eventType"
  | "processingStatus"
  | "metaPayload"
  | "waMessageId"
  | "errorMessage"
  | "processedAt"
  | "createdAt"
>

export function toWebhookEventDTO(
  event: Prisma.WhatsappWebhookEventGetPayload<Prisma.WhatsappWebhookEventDefaultArgs>,
): WhatsappWebhookEventDTO {
  return {
    id: event.id,
    organizationId: event.organizationId,
    whatsappDeviceId: event.whatsappDeviceId,
    eventType: event.eventType,
    processingStatus: event.processingStatus,
    waMessageId: event.waMessageId,
    errorMessage: event.errorMessage,
    processedAt: event.processedAt,
    createdAt: event.createdAt,
  }
}

export function toWebhookEventDetailDTO(
  event: Prisma.WhatsappWebhookEventGetPayload<Prisma.WhatsappWebhookEventDefaultArgs>,
): WhatsappWebhookEventDetailDTO {
  return {
    id: event.id,
    organizationId: event.organizationId,
    whatsappDeviceId: event.whatsappDeviceId,
    eventType: event.eventType,
    processingStatus: event.processingStatus,
    metaPayload: event.metaPayload,
    waMessageId: event.waMessageId,
    errorMessage: event.errorMessage,
    processedAt: event.processedAt,
    createdAt: event.createdAt,
  }
}
