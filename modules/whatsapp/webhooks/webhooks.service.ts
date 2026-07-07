import { prisma } from "@/lib/prisma"
import { Prisma, WhatsappMessageDeliveryStatus } from "@prisma/client"

import { toWebhookEventDTO, type WhatsappWebhookEventDTO } from "./webhooks.dto"
import { webhookDispatcher } from "./webhook-dispatcher.service"
import { downloadAndSave } from "@/modules/whatsapp/media/media.service"
import { upsertWhatsappContactFromMessage } from "@/modules/whatsapp/contacts/contacts.service"

export type ParsedMessagePayload = {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type?: string; sha256?: string }
  document?: {
    id: string
    mime_type?: string
    sha256?: string
    filename?: string
  }
  audio?: { id: string; mime_type?: string }
  video?: { id: string; mime_type?: string }
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
  [key: string]: unknown
}

export type ProcessMessageResult = {
  messageId: string
  conversationId: string
  isNewConversation: boolean
}

/**
 * Process an inbound message from the Meta webhook.
 * Finds or creates a conversation, then creates a WhatsappMessage record.
 */
export async function processInboundMessage(
  payload: ParsedMessagePayload,
  deviceId: string,
  organizationId: string
): Promise<ProcessMessageResult> {
  const from = payload.from
  if (!from || !payload.id) {
    throw new Error("Invalid message payload: missing 'from' or 'id'")
  }

  // Determine message body and media type
  const body = extractMessageBody(payload)
  const mediaUrl = extractMediaUrl(payload)
  const messageType = payload.type || "unknown"

  // Find or create conversation
  let conversation = await prisma.whatsappConversation.findFirst({
    where: {
      organizationId,
      contactPhone: from,
    },
  })

  const isNewConversation = !conversation

  if (!conversation) {
    conversation = await prisma.whatsappConversation.create({
      data: {
        organizationId,
        contactPhone: from,
        lastDirection: "INBOX",
        lastMessageAt: new Date(),
        whatsappDeviceId: deviceId,
      },
    })
  } else {
    // Update existing conversation
    await prisma.whatsappConversation.update({
      where: { id: conversation.id },
      data: {
        lastDirection: "INBOX",
        lastMessageAt: new Date(),
      },
    })
  }

  // Create the inbound message record
  const whatsappMessage = await prisma.whatsappMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOX",
      messageType,
      body: body ?? undefined,
      mediaUrl: mediaUrl ?? undefined,
      waMessageId: payload.id,
      metadata: {
        rawPayload: payload,
        deviceId,
        organizationId,
      } as Prisma.InputJsonValue,
    },
  })

    // Upsert contact from this inbound message — mark isWhatsapp: true
    await upsertWhatsappContactFromMessage({
      organizationId,
      phoneNumber: from,
      whatsappDeviceId: deviceId,
      messageAt: whatsappMessage.createdAt,
      isWhatsapp: true,
      waId: from,
      markChecked: true,
    })

  // Increment daily + monthly inbox counters
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1

  await Promise.all([
    prisma.whatsappDailyCount.upsert({
      where: {
        organizationId_date_whatsappDeviceId: {
          organizationId,
          date: today,
          whatsappDeviceId: deviceId,
        },
      },
      update: { messageInboxCount: { increment: 1 } },
      create: {
        organizationId,
        date: today,
        whatsappDeviceId: deviceId,
        messageInboxCount: 1,
      },
    }),
    prisma.whatsappMonthlyCount.upsert({
      where: {
        organizationId_year_month_whatsappDeviceId: {
          organizationId,
          year,
          month,
          whatsappDeviceId: deviceId,
        },
      },
      update: { messageInboxCount: { increment: 1 } },
      create: {
        organizationId,
        year,
        month,
        whatsappDeviceId: deviceId,
        messageInboxCount: 1,
      },
    }),
  ])

  // Fire-and-forget: dispatch webhook to customer-configured URLs
  webhookDispatcher
    .dispatchForDevice(
      deviceId,
      "inbound_message",
      { message: whatsappMessage, conversation },
      whatsappMessage.id
    )
    .catch((err: unknown) =>
      console.error(
        `[webhooks] dispatch failed for inbound_message device=${deviceId}`,
        err
      )
    )

  // Fire-and-forget: download media from Meta if this is a media message
  // ponytail: background download, don't block the webhook response
  const mediaId = extractMediaMetaId(payload)
  if (mediaId) {
    downloadAndSave(deviceId, organizationId, mediaId)
      .then((record) => {
        // Update the message metadata with media reference
        const existingMeta = (whatsappMessage.metadata as Record<string, unknown>) ?? {}
        existingMeta.whatsappMediaId = record.id
        existingMeta.mediaDownloaded = true

        prisma.whatsappMessage
          .update({
            where: { id: whatsappMessage.id },
            data: { metadata: existingMeta as Prisma.InputJsonValue, mediaUrl: `__stored:${record.id}` },
          })
          .catch((err: unknown) =>
            console.error(`[webhooks] failed to update message with media ref: ${whatsappMessage.id}`, err)
          )

        return record
      })
      .catch((err: unknown) =>
        console.error(
          `[webhooks] background media download failed device=${deviceId} mediaId=${mediaId}`,
          err
        )
      )
  }

  return {
    messageId: whatsappMessage.id,
    conversationId: conversation.id,
    isNewConversation,
  }
}

/**
 * Extract text body from a message payload depending on type.
 */
export function extractMessageBody(payload: ParsedMessagePayload): string | null {
  const msgType = payload.type

  if (msgType === "text" && payload.text?.body) {
    return payload.text.body
  }

  if (msgType === "location" && payload.location) {
    const loc = payload.location
    return `Location: ${loc.latitude},${loc.longitude}${loc.name ? ` (${loc.name})` : ""}`
  }

  if (msgType === "interactive" && typeof payload.interactive === "object") {
    const interactive = payload.interactive as Record<string, unknown>
    if (
      interactive.button_reply &&
      typeof interactive.button_reply === "object"
    ) {
      return String(
        (interactive.button_reply as Record<string, unknown>).title ?? ""
      )
    }
    if (interactive.list_reply && typeof interactive.list_reply === "object") {
      return String(
        (interactive.list_reply as Record<string, unknown>).title ?? ""
      )
    }
  }

  if (msgType === "button" && typeof payload.button === "object") {
    const button = payload.button as Record<string, unknown>
    return String(button.text ?? "")
  }

  if (msgType === "order" && typeof payload.order === "object") {
    return "[Order message]"
  }

  if (msgType === "system" && typeof payload.system === "object") {
    const system = payload.system as Record<string, unknown>
    return String(system.body ?? "[System message]")
  }

  return null
}

/**
 * Extract media URL/ID reference from message payload.
 * Uses `__media:{id}` placeholder until full media download is implemented.
 */
function extractMediaUrl(payload: ParsedMessagePayload): string | null {
  const msgType = payload.type

  if (msgType === "image" && payload.image?.id) {
    return `__media:${payload.image.id}`
  }

  if (msgType === "document" && payload.document?.id) {
    return `__media:${payload.document.id}`
  }

  if (msgType === "audio" && payload.audio?.id) {
    return `__media:${payload.audio.id}`
  }

  if (msgType === "video" && payload.video?.id) {
    return `__media:${payload.video.id}`
  }

  if (msgType === "sticker" && typeof payload.sticker === "object") {
    const sticker = payload.sticker as Record<string, unknown>
    if (sticker.id) {
      return `__media:${sticker.id}`
    }
  }

  return null
}

/**
 * Extract the raw Meta media ID from a media message payload.
 * Used to trigger background download.
 */
function extractMediaMetaId(payload: ParsedMessagePayload): string | null {
  const msgType = payload.type
  if (msgType === "image" && payload.image?.id) return payload.image.id
  if (msgType === "document" && payload.document?.id) return payload.document.id
  if (msgType === "audio" && payload.audio?.id) return payload.audio.id
  if (msgType === "video" && payload.video?.id) return payload.video.id
  if (msgType === "sticker" && typeof payload.sticker === "object") {
    const sticker = payload.sticker as Record<string, unknown>
    if (sticker.id) return String(sticker.id)
  }
  return null
}

// ─── Status (Delivery) Processing ─────────────────────────────────────────────────

export type ParsedStatusPayload = {
  id: string
  status: string
  timestamp: string
  recipient_id?: string
  errors?: Array<{
    code: number
    title?: string
    message?: string
    error_data?: { details?: string }
  }>
  [key: string]: unknown
}

export type ProcessStatusResult = {
  statusId: string
  messageId: string | null
  status: WhatsappMessageDeliveryStatus
}

/**
 * Map Meta status strings to Prisma enum.
 */
const STATUS_MAP: Record<string, WhatsappMessageDeliveryStatus> = {
  sent: WhatsappMessageDeliveryStatus.SENT,
  delivered: WhatsappMessageDeliveryStatus.DELIVERED,
  read: WhatsappMessageDeliveryStatus.READ,
  failed: WhatsappMessageDeliveryStatus.FAILED,
}

/**
 * Process a delivery status update from the Meta webhook.
 * Finds the outbound message by waMessageId and creates a status record.
 */
export async function processDeliveryStatus(
  payload: ParsedStatusPayload,
  deviceId: string,
  organizationId: string
): Promise<ProcessStatusResult> {
  const waMessageId = payload.id
  const metaStatus = payload.status
  const mappedStatus = STATUS_MAP[metaStatus]

  if (!mappedStatus) {
    throw new Error(`Unknown delivery status: "${metaStatus}"`)
  }

  // Find the message by waMessageId (scoped to organization via device)
  const message = await prisma.whatsappMessage.findFirst({
    where: { waMessageId },
    select: {
      id: true,
      conversationId: true,
      conversation: {
        select: {
          contactPhone: true,
          organizationId: true,
          whatsappDeviceId: true,
        },
      },
    },
  })

  if (!message) {
    console.warn(
      `[whatsapp-webhook] status for unknown waMessageId: ${waMessageId}, device=${deviceId}`
    )
    return {
      statusId: "",
      messageId: null,
      status: mappedStatus,
    }
  }

  // Extract error details for failed status
  let errorDetails: string | undefined
  if (metaStatus === "failed" && payload.errors?.length) {
    const firstError = payload.errors[0]
    const parts: string[] = []

    if (firstError.code) {
      parts.push(`code=${firstError.code}`)
    }
    if (firstError.title) {
      parts.push(firstError.title)
    }
    if (firstError.error_data?.details) {
      parts.push(firstError.error_data.details)
    }

    errorDetails = parts.join(" · ") || "Unknown error"
  }

  // Parse timestamp from Meta (Unix seconds)
  const timestamp = payload.timestamp
    ? new Date(Number(payload.timestamp) * 1000)
    : undefined

  // Create status record
  const statusRecord = await prisma.whatsappMessageStatus.create({
    data: {
      messageId: message.id,
      status: mappedStatus,
      timestamp,
      error: errorDetails,
    },
  })
  // Upsert contact on successful delivery statuses (SENT, DELIVERED, READ)
  if (
    mappedStatus &&
    [WhatsappMessageDeliveryStatus.SENT, WhatsappMessageDeliveryStatus.DELIVERED, WhatsappMessageDeliveryStatus.READ].includes(mappedStatus) &&
    message.conversation
  ) {
    await upsertWhatsappContactFromMessage({
      organizationId: message.conversation.organizationId,
      phoneNumber: message.conversation.contactPhone,
      whatsappDeviceId: message.conversation.whatsappDeviceId ?? deviceId,
      messageAt: timestamp ?? new Date(),
      isWhatsapp: true,
      waId: payload.recipient_id ?? null,
      markChecked: true,
    })
  }
  // Update conversation lastMessageAt
  await prisma.whatsappConversation
    .update({
      where: { id: message.conversationId },
      data: { lastMessageAt: new Date() },
    })
    .catch((err: unknown) => {
      // Non-critical — log but don't fail the status update
      console.warn(
        `[whatsapp-webhook] failed to update conversation timestamp: ${message.conversationId}`,
        err
      )
    })

  // Fire-and-forget: dispatch webhook for status update
  webhookDispatcher
    .dispatchForDevice(
      deviceId,
      "status_update",
      { status: statusRecord, message },
      statusRecord.id
    )
    .catch((err: unknown) =>
      console.error(
        `[webhooks] dispatch failed for status_update device=${deviceId}`,
        err
      )
    )

  return {
    statusId: statusRecord.id,
    messageId: message.id,
    status: mappedStatus,
  }
}

// ─── Meta Webhook Envelope Handler ────────────────────────────────────────────────

/**
 * Handle an incoming Meta webhook payload.
 * Extracts the message or status from the Meta envelope and processes it.
 */
export async function handleIncomingWebhook(
  body: unknown,
  deviceId: string,
  organizationId: string
): Promise<
  { success: true; data?: unknown } | { success: false; error: string }
> {
  try {
    // Parse the Meta webhook envelope
    const payload = body as Record<string, unknown>
    const entry = (payload.entry as Record<string, unknown>[])?.[0]
    const changes = (entry?.changes as Record<string, unknown>[])?.[0]
    const value = changes?.value as Record<string, unknown> | undefined

    if (!value) {
      return { success: false, error: "Invalid webhook payload structure" }
    }

    // Check for messages
    const messages = value.messages as Record<string, unknown>[] | undefined
    if (messages && messages.length > 0) {
      const messagePayload = messages[0]
      const result = await processInboundMessage(
        messagePayload as ParsedMessagePayload,
        deviceId,
        organizationId
      )
      return { success: true, data: result }
    }

    // Check for statuses
    const statuses = value.statuses as Record<string, unknown>[] | undefined
    if (statuses && statuses.length > 0) {
      const statusPayload = statuses[0]
      const result = await processDeliveryStatus(
        statusPayload as ParsedStatusPayload,
        deviceId,
        organizationId
      )
      return { success: true, data: result }
    }

    return { success: false, error: "No messages or statuses found in payload" }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ─── Webhook Event Recording ──────────────────────────────────────────────────

/**
 * Params for listing webhook events.
 */
export type ListWebhookEventsParams = {
  organizationId: string
  whatsappDeviceId?: string
  eventType?: string
  processingStatus?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

/**
 * Paginated result for webhook event lists.
 */
export type PaginatedWebhookEventsResult = {
  data: WhatsappWebhookEventDTO[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

/**
 * Create a raw webhook event record BEFORE processing.
 * Returns the event ID so downstream can call recordProcessingResult().
 */
export async function createWebhookEvent(
  orgId: string,
  deviceId: string,
  eventType: string,
  metaPayload: Prisma.InputJsonValue
): Promise<string> {
  const event = await prisma.whatsappWebhookEvent.create({
    data: {
      organizationId: orgId,
      whatsappDeviceId: deviceId,
      eventType,
      metaPayload,
    },
  })
  return event.id
}

/**
 * Record the processing outcome for a previously inserted webhook event.
 */
export async function recordProcessingResult(
  eventId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  await prisma.whatsappWebhookEvent.update({
    where: { id: eventId },
    data: {
      processingStatus: status,
      errorMessage: errorMessage ?? null,
      processedAt: new Date(),
    },
  })
}

/**
 * List webhook events with org-scoped filtering and pagination.
 */
export async function listWebhookEvents(
  params: ListWebhookEventsParams
): Promise<PaginatedWebhookEventsResult> {
  const {
    organizationId,
    whatsappDeviceId,
    eventType,
    processingStatus,
    from,
    to,
    page = 1,
    limit = 20,
  } = params

  const where: Prisma.WhatsappWebhookEventWhereInput = { organizationId }

  if (whatsappDeviceId) {
    where.whatsappDeviceId = whatsappDeviceId
  }
  if (eventType) {
    where.eventType = eventType
  }
  if (processingStatus) {
    where.processingStatus = processingStatus
  }
  if (from || to) {
    where.createdAt = {}
    if (from) {
      where.createdAt.gte = new Date(from)
    }
    if (to) {
      where.createdAt.lte = new Date(to)
    }
  }

  const skip = (page - 1) * limit

  const [total, events] = await Promise.all([
    prisma.whatsappWebhookEvent.count({ where }),
    prisma.whatsappWebhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ])

  return {
    data: events.map(toWebhookEventDTO),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}
