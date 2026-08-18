import { describe, expect, it } from "bun:test"
import { Prisma } from "@prisma/client"

import { toWhatsappMessageDTO, toWhatsappSendResultDTO } from "./messages.dto"

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const updatedAt = new Date("2026-01-01T00:01:00.000Z")

const message = {
  id: "message-1",
  conversationId: "conversation-1",
  direction: "OUTBOX" as const,
  messageType: "text",
  body: "Hello from WhatsApp",
  mediaUrl: null,
  waMessageId: "wamid.1",
  metadata: { source: "test" } as Prisma.JsonValue,
  createdAt,
  updatedAt,
}

describe("WhatsApp message DTO mappers", () => {
  it("maps a send result and always marks it as sent", () => {
    expect(
      toWhatsappSendResultDTO({
        jobId: "job-1",
        messageId: "message-1",
        waMessageId: "wamid.1",
        status: "sent",
      })
    ).toEqual({
      status: "sent",
      jobId: "job-1",
      messageId: "message-1",
      waMessageId: "wamid.1",
    })
  })

  it("maps a message without status history", () => {
    expect(toWhatsappMessageDTO(message)).toEqual({
      ...message,
      statusHistory: undefined,
    })
  })

  it("maps status history while omitting relation fields", () => {
    const timestamp = new Date("2026-01-01T00:02:00.000Z")
    const messageWithStatusHistory = {
      ...message,
      statusHistory: [
        {
          id: "status-1",
          messageId: message.id,
          status: "DELIVERED" as const,
          timestamp,
          error: null,
          createdAt: timestamp,
        },
      ],
    }

    expect(toWhatsappMessageDTO(messageWithStatusHistory)).toEqual({
      ...message,
      statusHistory: [
        {
          id: "status-1",
          status: "DELIVERED",
          timestamp,
          error: null,
          createdAt: timestamp,
        },
      ],
    })
  })
})
