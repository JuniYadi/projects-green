import { describe, expect, it } from "bun:test"

import type {
  SendMessageInput,
  SendReplyInput,
  WebhookEventEntry,
} from "./types"

const textMessage = {
  to: "+14155550100",
  type: "text",
  payload: { body: "Hello" },
} satisfies SendMessageInput

const templateMessage = {
  to: "+14155550100",
  type: "template",
  payload: {
    templateId: "welcome",
    languageCode: "en_US",
    variables: { name: "Ada" },
  },
} satisfies SendMessageInput

const replyMessage = {
  to: "+14155550100",
  type: "image",
  payload: { link: "https://example.test/image.jpg", caption: "Photo" },
} satisfies SendReplyInput

const webhookEntry = {
  id: "business-account-1",
  changes: [
    {
      field: "messages",
      value: {
        messaging_product: "whatsapp",
        metadata: {
          display_phone_number: "+14155550100",
          phone_number_id: "phone-number-1",
        },
        contacts: [{ profile: { name: "Ada" }, wa_id: "14155550100" }],
        messages: [
          {
            from: "14155550100",
            id: "wamid.1",
            timestamp: "1767225600",
            type: "text",
            text: { body: "Hello" },
          },
        ],
        statuses: [
          {
            id: "wamid.1",
            status: "delivered",
            timestamp: "1767225601",
            recipient_id: "14155550100",
          },
        ],
      },
    },
  ],
} satisfies WebhookEventEntry

describe("Meta Cloud WhatsApp type structures", () => {
  it("accepts discriminated send message payloads", () => {
    expect(textMessage).toEqual({
      to: "+14155550100",
      type: "text",
      payload: { body: "Hello" },
    })
    expect(templateMessage.payload.variables).toEqual({ name: "Ada" })
  })

  it("accepts reply media payloads", () => {
    expect(replyMessage).toMatchObject({
      to: "+14155550100",
      type: "image",
      payload: { link: "https://example.test/image.jpg" },
    })
  })

  it("accepts webhook entries containing messages and statuses", () => {
    expect(webhookEntry.changes[0]?.value.messages?.[0]?.text?.body).toBe(
      "Hello"
    )
    expect(webhookEntry.changes[0]?.value.statuses?.[0]?.status).toBe(
      "delivered"
    )
  })
})
