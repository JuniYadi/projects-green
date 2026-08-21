import { Prisma } from "@prisma/client"

export type WhatsappSendResultDTO = {
  jobId: string
  messageId: string
  waMessageId: string
  status: "sent"
}

export function toWhatsappSendResultDTO(
  result: WhatsappSendResultDTO
): WhatsappSendResultDTO {
  return {
    jobId: result.jobId,
    messageId: result.messageId,
    waMessageId: result.waMessageId,
    status: "sent",
  }
}

export type WhatsappMessageStatusDTO = Pick<
  Prisma.WhatsappMessageStatusGetPayload<Prisma.WhatsappMessageStatusDefaultArgs>,
  "id" | "status" | "timestamp" | "error" | "createdAt"
>

export type WhatsappMessageDTO = Pick<
  Prisma.WhatsappMessageGetPayload<Prisma.WhatsappMessageDefaultArgs>,
  | "id"
  | "conversationId"
  | "direction"
  | "messageType"
  | "body"
  | "mediaUrl"
  | "waMessageId"
  | "metadata"
  | "createdAt"
  | "updatedAt"
> & {
  statusHistory?: WhatsappMessageStatusDTO[]
}

type MessageWithStatusHistory = Prisma.WhatsappMessageGetPayload<{
  include: { statusHistory: true }
}>

function toWhatsappMessageStatusDTO(
  status: Prisma.WhatsappMessageStatusGetPayload<Prisma.WhatsappMessageStatusDefaultArgs>
): WhatsappMessageStatusDTO {
  return {
    id: status.id,
    status: status.status,
    timestamp: status.timestamp,
    error: status.error,
    createdAt: status.createdAt,
  }
}

export function toWhatsappMessageDTO(
  message:
    | Prisma.WhatsappMessageGetPayload<Prisma.WhatsappMessageDefaultArgs>
    | MessageWithStatusHistory
): WhatsappMessageDTO {
  return {
    id: message.id,
    conversationId: message.conversationId,
    direction: message.direction,
    messageType: message.messageType,
    body: message.body,
    mediaUrl: message.mediaUrl,
    waMessageId: message.waMessageId,
    metadata: message.metadata,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    statusHistory:
      "statusHistory" in message
        ? message.statusHistory.map(toWhatsappMessageStatusDTO)
        : undefined,
  }
}

export type WhatsappMessageJourneyDTO = {
  message: {
    id: string
    conversationId: string
    direction: string
    messageType: string
    body: string | null
    mediaUrl: string | null
    waMessageId: string | null
    metadata: Record<string, unknown> | null
    createdAt: string
  }
  device: {
    id: string
    phoneNumber: string
    name?: string | null
    environment?: string | null
  } | null
  contact: {
    phoneNumber: string
    waId?: string | null
  } | null
  billing: {
    category: string
    quotaKey: string
    status: string
    createdAt: string
  } | null
  audit: {
    adminId: string | null
    actorName: string | null
    action: string
    ip: string | null
    userAgent: string | null
    origin: string
    createdAt: string
  } | null
  timeline: Array<{
    id: string
    status: string
    timestamp: string
    error: string | null
    label: string
    description?: string
  }>
  webhooks: Array<{
    id: string
    eventType: string
    processingStatus: string
    createdAt: string
  }>
}
