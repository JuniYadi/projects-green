import { Prisma } from "@prisma/client"

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
