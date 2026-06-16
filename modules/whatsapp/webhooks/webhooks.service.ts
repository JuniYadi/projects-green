import { prisma } from "@/lib/prisma"
import { Prisma, WhatsappMessageDeliveryStatus } from "@prisma/client"

export type ParsedMessagePayload = {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type?: string; sha256?: string }
  document?: { id: string; mime_type?: string; sha256?: string; filename?: string }
  audio?: { id: string; mime_type?: string }
  video?: { id: string; mime_type?: string }
  location?: { latitude: number; longitude: number; name?: string; address?: string }
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
  organizationId: string,
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

  return {
    messageId: whatsappMessage.id,
    conversationId: conversation.id,
    isNewConversation,
  }
}

/**
 * Extract text body from a message payload depending on type.
 */
function extractMessageBody(payload: ParsedMessagePayload): string | null {
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
      return String((interactive.button_reply as Record<string, unknown>).title ?? "")
    }
    if (
      interactive.list_reply &&
      typeof interactive.list_reply === "object"
    ) {
      return String((interactive.list_reply as Record<string, unknown>).title ?? "")
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
  organizationId: string,
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
    select: { id: true, conversationId: true },
  })

  if (!message) {
    console.warn(
      `[whatsapp-webhook] status for unknown waMessageId: ${waMessageId}, device=${deviceId}`,
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

  // Update conversation lastMessageAt
  await prisma.whatsappConversation.update({
    where: { id: message.conversationId },
    data: { lastMessageAt: new Date() },
  }).catch((err: unknown) => {
    // Non-critical — log but don't fail the status update
    console.warn(
      `[whatsapp-webhook] failed to update conversation timestamp: ${message.conversationId}`,
      err,
    )
  })

  return {
    statusId: statusRecord.id,
    messageId: message.id,
    status: mappedStatus,
  }
}
