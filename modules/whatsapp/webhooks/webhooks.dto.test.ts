import { describe, expect, it } from "bun:test"

import { toWebhookEventDTO, toWebhookEventDetailDTO } from "./webhooks.dto"

const baseEvent = {
  id: "event-1",
  organizationId: "org-1",
  whatsappDeviceId: "device-1",
  eventType: "unknown",
  processingStatus: "PENDING",
  waMessageId: null,
  errorMessage: null,
  processedAt: null,
  createdAt: new Date("2026-08-20T12:00:00.000Z"),
  whatsappDevice: { phoneNumber: "+6281234567890" },
}

describe("toWebhookEventDTO and extractEventMetadata", () => {
  it("does not infer a delivery status from unrelated payload fields", () => {
    const result = toWebhookEventDTO({
      ...baseEvent,
      metaPayload: { status: "HTTP_OK" },
    } as never)

    expect(result.deliveryStatus).toBe("PENDING")
    expect(result.phoneNumber).toBeNull()
  })

  it("does not infer an inbound phone from unrelated payload fields", () => {
    const result = toWebhookEventDTO({
      ...baseEvent,
      metaPayload: { from: "+628111111111" },
    } as never)

    expect(result.deliveryStatus).toBe("PENDING")
    expect(result.phoneNumber).toBeNull()
  })

  it("extracts metadata from direct inbound_message payload", () => {
    const result = toWebhookEventDTO({
      ...baseEvent,
      eventType: "inbound_message",
      metaPayload: {
        id: "wamid.inbound.direct",
        from: "+628123456789",
        type: "text",
      },
    } as never)

    expect(result.waMessageId).toBe("wamid.inbound.direct")
    expect(result.phoneNumber).toBe("+628123456789")
    expect(result.deliveryStatus).toBe("RECEIVED")
  })

  it("extracts metadata from direct status_update payload", () => {
    const result = toWebhookEventDTO({
      ...baseEvent,
      eventType: "status_update",
      metaPayload: {
        id: "wamid.status.direct",
        recipient_id: "+628198765432",
        status: "delivered",
      },
    } as never)

    expect(result.waMessageId).toBe("wamid.status.direct")
    expect(result.phoneNumber).toBe("+628198765432")
    expect(result.deliveryStatus).toBe("DELIVERED")
  })

  it("extracts metadata from Meta envelope for inbound_message", () => {
    const result = toWebhookEventDTO({
      ...baseEvent,
      eventType: "inbound_message",
      metaPayload: {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba-1",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    phone_number_id: "phone-1",
                  },
                  messages: [
                    {
                      id: "wamid.inbound.envelope",
                      from: "+628123456789",
                      type: "text",
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    } as never)

    expect(result.waMessageId).toBe("wamid.inbound.envelope")
    expect(result.phoneNumber).toBe("+628123456789")
    expect(result.deliveryStatus).toBe("RECEIVED")
  })

  it("extracts metadata from Meta envelope for status_update", () => {
    const result = toWebhookEventDTO({
      ...baseEvent,
      eventType: "status_update",
      metaPayload: {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba-1",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    phone_number_id: "phone-1",
                  },
                  statuses: [
                    {
                      id: "wamid.status.envelope",
                      recipient_id: "+628198765432",
                      status: "read",
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    } as never)

    expect(result.waMessageId).toBe("wamid.status.envelope")
    expect(result.phoneNumber).toBe("+628198765432")
    expect(result.deliveryStatus).toBe("READ")
  })

  it("toWebhookEventDetailDTO delegates to toWebhookEventDTO", () => {
    const result = toWebhookEventDetailDTO({
      ...baseEvent,
      metaPayload: { foo: "bar" },
    } as never)

    expect(result.metaPayload).toEqual({ foo: "bar" })
  })
})
