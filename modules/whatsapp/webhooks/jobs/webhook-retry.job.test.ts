import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockFindFirst = mock(() => Promise.resolve(null))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findFirst: mockFindFirst,
    },
  },
}))

const mockEnqueue = mock(() => Promise.resolve({}))
mock.module("@/lib/queue/base-job", () => {
  class BaseJob {
    static enqueue(data?: unknown, opts?: unknown) {
      return mockEnqueue(data, opts)
    }
  }
  return { BaseJob }
})
const mockRecordProcessingResult = mock(() => Promise.resolve({}))
const mockProcessInboundMessage = mock(() => Promise.resolve({}))
const mockProcessDeliveryStatus = mock(() => Promise.resolve({}))
mock.module("../webhooks.service", () => ({
  recordProcessingResult: mockRecordProcessingResult,
  processInboundMessage: mockProcessInboundMessage,
  processDeliveryStatus: mockProcessDeliveryStatus,
}))

const mockCreateDeadLetter = mock(() => Promise.resolve({}))
mock.module("../services/webhook-dead-letter.service", () => ({
  createDeadLetter: mockCreateDeadLetter,
}))

const mockProcessTemplateStatusUpdate = mock(() => Promise.resolve({}))
mock.module("../../templates/template-status-update.service", () => ({
  processTemplateStatusUpdate: mockProcessTemplateStatusUpdate,
}))

import {
  WebhookRetryJob,
  WHATSAPP_WEBHOOK_RETRY_QUEUE,
} from "./webhook-retry.job"

describe("WebhookRetryJob", () => {
  beforeEach(() => {
    mockFindFirst.mockClear()
    mockEnqueue.mockClear()
    mockRecordProcessingResult.mockClear()
    mockProcessInboundMessage.mockClear()
    mockProcessDeliveryStatus.mockClear()
    mockCreateDeadLetter.mockClear()
    mockProcessTemplateStatusUpdate.mockClear()
  })

  it("exposes queue configuration", () => {
    expect(WebhookRetryJob.queue).toBe(WHATSAPP_WEBHOOK_RETRY_QUEUE)
    expect(WebhookRetryJob.workerConcurrency).toBe(4)
    expect(WebhookRetryJob.attempts).toBe(3)
  })
  it("dispatches job with eventId in data and jobId option", async () => {
    const enqueueSpy = mock(() => Promise.resolve({} as unknown as never))
    WebhookRetryJob.enqueue = enqueueSpy

    await WebhookRetryJob.dispatch({
      eventId: "evt-123",
      eventType: "message",
      deviceId: "dev-1",
      payload: { from: "628123456789", text: "hello" },
    })

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt-123",
        eventType: "message",
      }),
      { jobId: "wa-retry-evt-123" }
    )
  })

  it("throws error if device is not found", async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const job = {
      data: {
        eventId: "evt-1",
        eventType: "message",
        deviceId: "dev-unknown",
        payload: { from: "6281234" },
      },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as unknown as never

    await expect(WebhookRetryJob.handle(job)).rejects.toThrow(
      "Device not found: dev-unknown"
    )
  })

  it("handles inbound message and records success", async () => {
    mockFindFirst.mockResolvedValueOnce({
      organizationId: "org-1",
    } as unknown as never)

    const job = {
      data: {
        eventId: "evt-msg",
        eventType: "message",
        deviceId: "dev-1",
        payload: { from: "628123456", text: "test" },
      },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as unknown as never

    await WebhookRetryJob.handle(job)

    expect(mockProcessInboundMessage).toHaveBeenCalledWith(
      { from: "628123456", text: "test" },
      "dev-1",
      "org-1"
    )
    expect(mockRecordProcessingResult).toHaveBeenCalledWith(
      "evt-msg",
      "SUCCESS"
    )
  })

  it("handles statuses event type", async () => {
    mockFindFirst.mockResolvedValueOnce({
      organizationId: "org-1",
    } as unknown as never)

    const job = {
      data: {
        eventId: "evt-status",
        eventType: "statuses",
        deviceId: "dev-1",
        payload: { id: "wamid.123", status: "delivered" },
      },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as unknown as never

    await WebhookRetryJob.handle(job)

    expect(mockProcessDeliveryStatus).toHaveBeenCalledWith(
      { id: "wamid.123", status: "delivered" },
      "dev-1",
      "org-1"
    )
    expect(mockRecordProcessingResult).toHaveBeenCalledWith(
      "evt-status",
      "SUCCESS"
    )
  })

  it("handles template_status_update event type", async () => {
    mockFindFirst.mockResolvedValueOnce({
      organizationId: "org-1",
    } as unknown as never)

    const job = {
      data: {
        eventId: "evt-template",
        eventType: "template_status_update",
        deviceId: "dev-1",
        payload: { event: "APPROVED", message_template_id: "tpl-1" },
      },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as unknown as never

    await WebhookRetryJob.handle(job)

    expect(mockProcessTemplateStatusUpdate).toHaveBeenCalledWith(
      "org-1",
      "dev-1",
      { event: "APPROVED", message_template_id: "tpl-1" }
    )
  })

  it("creates dead letter when error happens on final attempt", async () => {
    mockFindFirst.mockResolvedValueOnce({
      organizationId: "org-1",
    } as unknown as never)
    mockProcessInboundMessage.mockRejectedValueOnce(
      new Error("Downstream service error")
    )

    const job = {
      data: {
        eventId: "evt-failed",
        eventType: "message",
        deviceId: "dev-1",
        payload: { from: "628123456" },
      },
      opts: { attempts: 3 },
      attemptsMade: 2, // 3rd attempt (final)
    } as unknown as never

    await expect(WebhookRetryJob.handle(job)).rejects.toThrow(
      "Downstream service error"
    )

    expect(mockRecordProcessingResult).toHaveBeenCalledWith(
      "evt-failed",
      "FAILED",
      "Error: Downstream service error"
    )
    expect(mockCreateDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "dev-1",
        organizationId: "org-1",
        eventType: "inbound_message",
        attemptCount: 3,
      })
    )
  })
})
