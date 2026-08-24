import { describe, expect, it, mock } from "bun:test"
import type { WhatsappOutgoingWebhookJobData } from "./whatsapp-webhook-outgoing"

const mockAdd = mock(async () => ({ id: "mock-job-id" }))

mock.module("./queue-config", () => ({
  getQueue: () => ({
    add: mockAdd,
  }),
}))

const { enqueueOutgoingWebhook, WHATSAPP_WEBHOOK_OUTGOING_JOB } =
  await import("./whatsapp-webhook-outgoing")

describe("whatsapp-webhook-outgoing", () => {
  it("enqueues outgoing webhook with deterministic event ID when present", async () => {
    mockAdd.mockClear()
    const data: WhatsappOutgoingWebhookJobData = {
      webhookId: "wh_123",
      organizationId: "org_123",
      deviceId: "dev_123",
      eventType: "message",
      eventId: "evt_123",
      payload: { foo: "bar" },
    }

    await enqueueOutgoingWebhook(data)

    expect(mockAdd).toHaveBeenCalledTimes(1)
    const call = mockAdd.mock.calls[0]
    expect(call[0]).toBe(WHATSAPP_WEBHOOK_OUTGOING_JOB)
    expect(call[1]).toEqual(data)
    expect(call[2]).toEqual({
      jobId: "wa-outgoing_wh_123_message_evt_123",
    })
    expect(call[2].jobId).not.toContain(":")
  })

  it("enqueues outgoing webhook with UUID v7 job ID when eventId is absent", async () => {
    mockAdd.mockClear()
    const data: WhatsappOutgoingWebhookJobData = {
      webhookId: "wh_456",
      organizationId: "org_456",
      deviceId: "dev_456",
      eventType: "status",
      payload: { foo: "baz" },
    }

    await enqueueOutgoingWebhook(data)

    expect(mockAdd).toHaveBeenCalledTimes(1)
    const call = mockAdd.mock.calls[0]
    expect(call[0]).toBe(WHATSAPP_WEBHOOK_OUTGOING_JOB)
    expect(call[1]).toEqual(data)
    const opts = call[2] as { jobId: string }
    expect(opts.jobId).toMatch(
      /^wa-outgoing_wh_456_status_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(opts.jobId).not.toContain(":")
  })
})
