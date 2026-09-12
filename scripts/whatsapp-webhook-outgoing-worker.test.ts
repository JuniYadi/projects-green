import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"

mock.module("bullmq", () => ({
  Worker: class {
    on() {
      return this
    }
    close() {}
  },
}))
mock.module("@/lib/queue/queue-config", () => ({
  getRedisConnection: () => ({}),
}))
mock.module("@/lib/queue/whatsapp-webhook-outgoing", () => ({
  WHATSAPP_WEBHOOK_OUTGOING_QUEUE: "whatsapp-webhook-outgoing",
}))
mock.module("@/lib/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}))

const webhook = (webhookUrl: string) => ({
  id: "wh-1",
  active: true,
  webhookUrl,
  authType: "none",
  authValue: null,
  authHeaderName: null,
  retryMaxAttempts: 1,
})

const mockWebhookFindUnique = mock(async () =>
  webhook("https://93.184.216.34/hook")
)
const mockLogFindFirst = mock(async () => null)
const mockLogCreate = mock(async () => ({}))
const mockLogUpdate = mock(async () => ({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappWebhook: { findUnique: mockWebhookFindUnique },
    whatsappWebhookDeliveryLog: {
      findFirst: mockLogFindFirst,
      create: mockLogCreate,
      update: mockLogUpdate,
    },
  },
}))

const fetchSpy = spyOn(globalThis, "fetch")

const { processOutgoingWebhookJob } =
  await import("./whatsapp-webhook-outgoing-worker")

const job = {
  data: {
    webhookId: "wh-1",
    organizationId: "org-1",
    deviceId: "dev-1",
    eventType: "message.received",
    eventId: "evt-1",
    payload: { id: "msg-1" },
  },
  attemptsMade: 0,
} as never

const respondWith = (response: () => Response) =>
  (async () => response()) as unknown as typeof fetch

describe("processOutgoingWebhookJob outbound URL safety (WA-C07)", () => {
  beforeEach(() => {
    mockWebhookFindUnique.mockClear()
    mockLogCreate.mockClear()
    fetchSpy.mockReset()
    fetchSpy.mockImplementation(
      respondWith(() => new Response("ok", { status: 200 }))
    )
  })

  it("never requests a webhook URL that points at an internal address", async () => {
    mockWebhookFindUnique.mockResolvedValueOnce(
      webhook("http://169.254.169.254/latest/meta-data")
    )

    await processOutgoingWebhookJob(job)

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DEAD_LETTERED" }),
      })
    )
  })

  it("does not follow redirects from the customer endpoint", async () => {
    fetchSpy.mockImplementation(
      respondWith(
        () =>
          new Response(null, {
            status: 302,
            headers: { location: "http://169.254.169.254/" },
          })
      )
    )

    await processOutgoingWebhookJob(job)

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://93.184.216.34/hook",
      expect.objectContaining({ redirect: "manual" })
    )
  })
})
