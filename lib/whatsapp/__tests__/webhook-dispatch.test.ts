import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { createHmac } from "node:crypto"
import { resetIdempotencyStore } from "../idempotency-repository"
import type { WhatsAppWebhookJobData } from "@/lib/queue/whatsapp-webhook"

// Mock the webhook queue module
const mockEnqueue = mock<
  (
    eventType: WhatsAppWebhookJobData["eventType"],
    payload: unknown,
    deviceId: string,
    organizationId?: string
  ) => Promise<void>
>(async () => {})

mock.module("@/lib/queue/whatsapp-webhook", () => ({
  enqueueWhatsAppWebhook: mockEnqueue,
}))

// Now import the modules under test
const { handleEventUseCase } = await import("../handle-event")
const { dispatchWebhookEvents } = await import("../webhook-routes")
const { verifySignature } = await import("../webhook")

beforeEach(async () => {
  mockEnqueue.mockClear()
  await resetIdempotencyStore()
})

afterEach(async () => {
  mockEnqueue.mockClear()
  await resetIdempotencyStore()
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function createMetaPayload({
  messages = [],
  statuses = [],
  phoneNumberId = "123456789",
}: {
  messages?: unknown[]
  statuses?: unknown[]
  phoneNumberId?: string
} = {}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-id-123",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                phone_number_id: phoneNumberId,
                display_phone_number: "+15551234567",
              },
              ...(messages.length > 0 ? { messages } : {}),
              ...(statuses.length > 0 ? { statuses } : {}),
            },
            field: "messages",
          },
        ],
      },
    ],
  }
}

const sampleTextMessage = {
  from: "+15559876543",
  id: "wamid.abc123",
  timestamp: "1680000000",
  text: { body: "Hello from Meta!" },
  type: "text",
}

const sampleStatusSent = {
  id: "wamid.status456",
  status: "sent",
  timestamp: "1680000001",
  recipient_id: "+15559876543",
}

describe("handleEventUseCase", () => {
  it("returns entries when payload is valid", async () => {
    const payload = createMetaPayload({
      messages: [sampleTextMessage],
      statuses: [sampleStatusSent],
    })

    const result = await handleEventUseCase(payload)

    expect(result).toHaveProperty("code", 200)
    expect(result).toHaveProperty("message", "EVENT_RECEIVED")
    expect(result).toHaveProperty("entries")

    const entries = (result as { entries: unknown[] }).entries
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      phoneNumberId: "123456789",
      messages: [sampleTextMessage],
      statuses: [sampleStatusSent],
    })
  })

  it("returns empty messages/statuses when none present", async () => {
    const payload = createMetaPayload()

    const result = await handleEventUseCase(payload)
    const entries = (result as { entries: unknown[] }).entries

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      messages: [],
      statuses: [],
    })
  })

  it("returns 400 for invalid payload", async () => {
    const result = await handleEventUseCase({ not: "an envelope" })
    expect(result).toMatchObject({ code: 400, message: "INVALID_PAYLOAD" })
  })

  it("returns 400 for null payload", async () => {
    const result = await handleEventUseCase(null)
    expect(result).toMatchObject({ code: 400, message: "INVALID_PAYLOAD" })
  })

  it("returns duplicate true for duplicate payload (content hash)", async () => {
    const payload = createMetaPayload({ messages: [sampleTextMessage] })
    const rawBody = JSON.stringify(payload)

    await handleEventUseCase(payload, { rawBody })
    const result = await handleEventUseCase(payload, { rawBody })

    expect(result).toHaveProperty("duplicate", true)
  })

  it("accepts unique payloads", async () => {
    const payload1 = createMetaPayload({
      messages: [{ ...sampleTextMessage, id: "msg-1" }],
    })
    const payload2 = createMetaPayload({
      messages: [{ ...sampleTextMessage, id: "msg-2" }],
    })
    const rawBody1 = JSON.stringify(payload1)
    const rawBody2 = JSON.stringify(payload2)

    await handleEventUseCase(payload1, { rawBody: rawBody1 })
    const result = await handleEventUseCase(payload2, { rawBody: rawBody2 })

    expect(result).toHaveProperty("code", 200)
    expect(result).not.toHaveProperty("duplicate")
  })
})

describe("dispatchWebhookEvents", () => {
  it("enqueues message events for each message in payload", async () => {
    const payload = createMetaPayload({
      messages: [
        { ...sampleTextMessage, id: "msg-1" },
        { ...sampleTextMessage, id: "msg-2" },
      ],
    })

    await dispatchWebhookEvents(payload)

    expect(mockEnqueue).toHaveBeenCalledTimes(2)
    expect(mockEnqueue).toHaveBeenCalledWith(
      "message",
      expect.objectContaining({ id: "msg-1" }),
      "123456789",
    )
    expect(mockEnqueue).toHaveBeenCalledWith(
      "message",
      expect.objectContaining({ id: "msg-2" }),
      "123456789",
    )
  })

  it("enqueues status events for each status in payload", async () => {
    const payload = createMetaPayload({
      statuses: [
        { ...sampleStatusSent, id: "st-1" },
        { ...sampleStatusSent, id: "st-2" },
      ],
    })

    await dispatchWebhookEvents(payload)

    expect(mockEnqueue).toHaveBeenCalledTimes(2)
    expect(mockEnqueue).toHaveBeenCalledWith(
      "statuses",
      expect.objectContaining({ id: "st-1" }),
      "123456789",
    )
    expect(mockEnqueue).toHaveBeenCalledWith(
      "statuses",
      expect.objectContaining({ id: "st-2" }),
      "123456789",
    )
  })

  it("enqueues both messages and statuses when both present", async () => {
    const payload = createMetaPayload({
      messages: [sampleTextMessage],
      statuses: [sampleStatusSent],
    })

    await dispatchWebhookEvents(payload)

    expect(mockEnqueue).toHaveBeenCalledTimes(2)
    expect(mockEnqueue).toHaveBeenCalledWith(
      "message",
      expect.objectContaining({ id: "wamid.abc123" }),
      "123456789",
    )
    expect(mockEnqueue).toHaveBeenCalledWith(
      "statuses",
      expect.objectContaining({ id: "wamid.status456" }),
      "123456789",
    )
  })

  it("does not enqueue for invalid payload", async () => {
    await dispatchWebhookEvents({ invalid: true })
    expect(mockEnqueue).toHaveBeenCalledTimes(0)
  })

  it("does not enqueue for duplicate payload", async () => {
    const payload = createMetaPayload({
      messages: [sampleTextMessage],
    })
    const rawBody = JSON.stringify(payload)

    await dispatchWebhookEvents(payload, rawBody)
    // Second call should be ignored as duplicate
    await dispatchWebhookEvents(payload, rawBody)

    // Only the first call should result in enqueue
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
  })

  it("handles empty entries gracefully", async () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [],
    }

    await dispatchWebhookEvents(payload)

    expect(mockEnqueue).toHaveBeenCalledTimes(0)
  })

  it("handles entry without changes gracefully", async () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{ id: "waba-1", changes: [] }],
    }

    await dispatchWebhookEvents(payload)

    expect(mockEnqueue).toHaveBeenCalledTimes(0)
  })
})

describe("verifySignature", () => {
  const originalSecret = process.env.META_APP_SECRET

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.META_APP_SECRET
    } else {
      process.env.META_APP_SECRET = originalSecret
    }
  })

  it("returns false when META_APP_SECRET is not set", () => {
    delete process.env.META_APP_SECRET
    const result = verifySignature("{}", "sha256=abc")
    expect(result).toBe(false)
  })

  it("returns false for invalid signature format", () => {
    process.env.META_APP_SECRET = "test-secret"
    const result = verifySignature("{}", "not-a-sha256-signature")
    expect(result).toBe(false)
  })

  it("returns false for empty signature", () => {
    process.env.META_APP_SECRET = "test-secret"
    const result = verifySignature("{}", "")
    expect(result).toBe(false)
  })

  it("returns true for valid signature", () => {
    process.env.META_APP_SECRET = "test-secret"
    // Calculate expected HMAC using the same function the module uses
    const expectedHash = createHmac("sha256", "test-secret")
      .update('{"key":"value"}')
      .digest("hex")

    const result = verifySignature('{"key":"value"}', `sha256=${expectedHash}`)
    expect(result).toBe(true)
  })

  it("returns false for mismatched signature", () => {
    process.env.META_APP_SECRET = "test-secret"
    const result = verifySignature('{"key":"value"}', "sha256=0000000000000000000000000000000000000000000000000000000000000000")
    expect(result).toBe(false)
  })
})
