import { describe, expect, it } from "bun:test"

import { toWebhookEventDTO } from "./webhooks.dto"

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

describe("toWebhookEventDTO", () => {
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
})
