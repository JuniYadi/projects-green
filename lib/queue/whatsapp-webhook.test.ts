import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import type { JobsOptions } from "bullmq"
import type { WhatsAppWebhookJobData } from "@/lib/queue/whatsapp-webhook"

const queueAddMock = mock(
  async (_name: string, _data: WhatsAppWebhookJobData, _opts?: JobsOptions) => {
    void _name
    void _data
    void _opts
    return { id: "job_1" }
  }
)
const queueCloseMock = mock(async () => undefined)
const queueConstructorMock = mock((...args: unknown[]) => {
  void args
})

class QueueMock {
  constructor(name: string, options: Record<string, unknown>) {
    queueConstructorMock(name, options)
  }

  async add(name: string, data: WhatsAppWebhookJobData, opts?: JobsOptions) {
    return queueAddMock(name, data, opts)
  }

  async close() {
    return queueCloseMock()
  }
}

mock.module("bullmq", () => ({ Queue: QueueMock }))

const {
  __testing,
  createWhatsAppWebhookQueue,
  enqueueWhatsAppWebhook,
  getWhatsAppWebhookRedisConnection,
  WHATSAPP_WEBHOOK_JOB_NAME,
  WHATSAPP_WEBHOOK_QUEUE_NAME,
} = await import("@/lib/queue/whatsapp-webhook")

const originalRedisUrl = process.env.REDIS_URL

beforeEach(async () => {
  queueAddMock.mockClear()
  queueCloseMock.mockClear()
  queueConstructorMock.mockClear()
  await __testing.resetQueueCache()
})

afterEach(async () => {
  if (originalRedisUrl === undefined) {
    delete process.env.REDIS_URL
  } else {
    process.env.REDIS_URL = originalRedisUrl
  }

  await __testing.resetQueueCache()
})

describe("getWhatsAppWebhookRedisConnection", () => {
  it("uses db 0 when REDIS_URL has no explicit DB path", () => {
    process.env.REDIS_URL = "redis://localhost:6379"

    const connection = getWhatsAppWebhookRedisConnection()

    expect(connection.db).toBe(0)
    expect(connection.port).toBe(6379)
    expect(connection.host).toBe("localhost")
    expect(connection.tls).toBeUndefined()
  })

  it("parses db index from URL path", () => {
    process.env.REDIS_URL = "redis://localhost:6379/5"

    const connection = getWhatsAppWebhookRedisConnection()

    expect(connection.db).toBe(5)
  })

  it("returns 0 for empty path (just /)", () => {
    process.env.REDIS_URL = "redis://localhost:6379/"

    const connection = getWhatsAppWebhookRedisConnection()

    expect(connection.db).toBe(0)
  })

  it("parses auth, db index, and rediss tls", () => {
    process.env.REDIS_URL = "rediss://alice:secret@cache.example.com:6380/5"

    const connection = getWhatsAppWebhookRedisConnection()

    expect(connection).toMatchObject({
      host: "cache.example.com",
      port: 6380,
      username: "alice",
      password: "secret",
      db: 5,
    })
    expect(connection.tls).toEqual({})
  })

  it("uses default port 6379 when port is not specified", () => {
    process.env.REDIS_URL = "redis://localhost"

    const connection = getWhatsAppWebhookRedisConnection()

    expect(connection.port).toBe(6379)
  })

  it("throws for missing env", () => {
    delete process.env.REDIS_URL
    expect(() => getWhatsAppWebhookRedisConnection()).toThrow(
      "Missing REDIS_URL environment variable"
    )
  })

  it("throws for non-numeric db path", () => {
    process.env.REDIS_URL = "redis://localhost:6379/not-a-db"
    expect(() => getWhatsAppWebhookRedisConnection()).toThrow(
      'Invalid REDIS_URL database path: "/not-a-db"'
    )
  })

  it("throws for negative db index", () => {
    process.env.REDIS_URL = "redis://localhost:6379/-1"
    expect(() => getWhatsAppWebhookRedisConnection()).toThrow(
      'Invalid REDIS_URL database path: "/-1"'
    )
  })

  it("throws for invalid port", () => {
    process.env.REDIS_URL = "redis://localhost:0"
    expect(() => getWhatsAppWebhookRedisConnection()).toThrow(
      "Invalid REDIS_URL port"
    )
  })
})

describe("createWhatsAppWebhookQueue", () => {
  it("uses injected queue and skips close ownership", async () => {
    const add = mock(async () => ({ id: "job_injected" }))
    const queue = createWhatsAppWebhookQueue({
      queue: {
        add,
      },
      jobName: "custom-job",
    })

    await queue.enqueue({
      eventType: "message",
      payload: { message: "hello" },
      deviceId: "device_1",
    })
    await queue.close()

    expect(add).toHaveBeenCalledWith(
      "custom-job",
      {
        eventType: "message",
        payload: { message: "hello" },
        deviceId: "device_1",
      },
      expect.objectContaining({
        jobId: expect.stringContaining("wa-webhook:message:"),
      })
    )
    expect(queueCloseMock).toHaveBeenCalledTimes(0)
  })

  it("creates and closes owned queue when queue is not injected", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/2"

    const queue = createWhatsAppWebhookQueue({
      queueName: "test-webhook-queue",
      defaultJobOptions: { attempts: 5 },
    })

    await queue.enqueue({
      eventType: "statuses",
      payload: { status: "sent" },
      deviceId: "device_owned",
    })
    await queue.close()

    expect(queueConstructorMock).toHaveBeenCalledTimes(1)
    expect(queueConstructorMock).toHaveBeenCalledWith(
      "test-webhook-queue",
      expect.objectContaining({
        defaultJobOptions: { attempts: 5 },
      })
    )
    expect(queueAddMock).toHaveBeenCalledWith(
      WHATSAPP_WEBHOOK_JOB_NAME,
      {
        eventType: "statuses",
        payload: { status: "sent" },
        deviceId: "device_owned",
      },
      expect.objectContaining({
        jobId: expect.stringContaining("wa-webhook:statuses:"),
      })
    )
    expect(queueCloseMock).toHaveBeenCalledTimes(1)
  })

  it("merges default job options with provided options", async () => {
    const add = mock(async () => ({ id: "job_merged" }))
    const queue = createWhatsAppWebhookQueue({
      queue: { add },
    })

    await queue.enqueue(
      { eventType: "error", payload: { error: "test" }, deviceId: "device_2" },
      { attempts: 5 }
    )

    expect(add).toHaveBeenCalledWith(
      WHATSAPP_WEBHOOK_JOB_NAME,
      { eventType: "error", payload: { error: "test" }, deviceId: "device_2" },
      expect.objectContaining({
        jobId: expect.stringContaining("wa-webhook:error:"),
        attempts: 5,
      })
    )
  })

  it("close does nothing when queue is injected", async () => {
    const add = mock(async () => undefined)
    const queue = createWhatsAppWebhookQueue({
      queue: { add },
    })

    await queue.close()

    expect(queueCloseMock).toHaveBeenCalledTimes(0)
  })
})

describe("enqueueWhatsAppWebhook", () => {
  it("reuses shared queue and enqueues with deterministic job ids", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/0"

    const startTime = Date.now()

    await enqueueWhatsAppWebhook("message", { text: "hello" }, "device_a")
    await enqueueWhatsAppWebhook(
      "statuses",
      { status: "delivered" },
      "device_b",
      "org_1"
    )
    await enqueueWhatsAppWebhook("error", { error: "timeout" }, "device_c")

    expect(queueConstructorMock).toHaveBeenCalledTimes(1)
    expect(queueAddMock).toHaveBeenCalledTimes(3)

    const calls = queueAddMock.mock.calls as Array<
      [string, WhatsAppWebhookJobData, JobsOptions]
    >

    expect(calls[0][0]).toBe(WHATSAPP_WEBHOOK_JOB_NAME)
    expect(calls[0][1]).toEqual({
      eventType: "message",
      payload: { text: "hello" },
      deviceId: "device_a",
    })
    expect(calls[0][2]!.jobId).toContain("wa-webhook:message:device_a:")
    expect(calls[0][2]!.jobId!.length).toBeGreaterThan(
      `wa-webhook:message:device_a:${startTime}`.length - 2
    )

    expect(calls[1][0]).toBe(WHATSAPP_WEBHOOK_JOB_NAME)
    expect(calls[1][1]).toEqual({
      eventType: "statuses",
      payload: { status: "delivered" },
      deviceId: "device_b",
      organizationId: "org_1",
    })

    expect(calls[2][0]).toBe(WHATSAPP_WEBHOOK_JOB_NAME)
    expect(calls[2][1]).toEqual({
      eventType: "error",
      payload: { error: "timeout" },
      deviceId: "device_c",
    })
  })

  it("defaults eventType to message", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/0"

    await enqueueWhatsAppWebhook("message", { text: "hi" }, "dev")

    expect(queueAddMock).toHaveBeenCalledWith(
      WHATSAPP_WEBHOOK_JOB_NAME,
      { eventType: "message", payload: { text: "hi" }, deviceId: "dev" },
      expect.objectContaining({
        jobId: expect.stringContaining("wa-webhook:message:dev:"),
      })
    )
  })
})

describe("constants", () => {
  it("exports correct queue and job names", () => {
    expect(WHATSAPP_WEBHOOK_QUEUE_NAME).toBe("whatsapp-webhook")
    expect(WHATSAPP_WEBHOOK_JOB_NAME).toBe("webhook-event")
  })
})
