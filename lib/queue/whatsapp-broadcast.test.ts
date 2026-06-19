import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import type { JobsOptions } from "bullmq"
import type { WhatsAppBroadcastJobData } from "@/lib/queue/whatsapp-broadcast"

const queueAddMock = mock(
  async (
    _name: string,
    _data: WhatsAppBroadcastJobData,
    _opts?: JobsOptions
  ) => {
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

  async add(name: string, data: WhatsAppBroadcastJobData, opts?: JobsOptions) {
    return queueAddMock(name, data, opts)
  }

  async close() {
    return queueCloseMock()
  }
}

mock.module("bullmq", () => ({ Queue: QueueMock }))

const {
  __testing,
  createWhatsAppBroadcastQueue,
  enqueueWhatsAppBroadcast,
  getWhatsAppBroadcastRedisConnection,
  WHATSAPP_BROADCAST_JOB_NAME,
  WHATSAPP_BROADCAST_QUEUE_NAME,
} = await import("@/lib/queue/whatsapp-broadcast")

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

describe("getWhatsAppBroadcastRedisConnection", () => {
  it("uses db 0 when REDIS_URL has no explicit DB path", () => {
    process.env.REDIS_URL = "redis://localhost:6379"

    const connection = getWhatsAppBroadcastRedisConnection()

    expect(connection.db).toBe(0)
    expect(connection.port).toBe(6379)
    expect(connection.host).toBe("localhost")
    expect(connection.tls).toBeUndefined()
  })

  it("parses db index from URL path", () => {
    process.env.REDIS_URL = "redis://localhost:6379/5"

    const connection = getWhatsAppBroadcastRedisConnection()

    expect(connection.db).toBe(5)
  })

  it("returns 0 for empty path (just /)", () => {
    process.env.REDIS_URL = "redis://localhost:6379/"

    const connection = getWhatsAppBroadcastRedisConnection()

    expect(connection.db).toBe(0)
  })

  it("parses auth, db index, and rediss tls", () => {
    process.env.REDIS_URL = "rediss://alice:secret@cache.example.com:6380/5"

    const connection = getWhatsAppBroadcastRedisConnection()

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

    const connection = getWhatsAppBroadcastRedisConnection()

    expect(connection.port).toBe(6379)
  })

  it("throws for missing env", () => {
    delete process.env.REDIS_URL
    expect(() => getWhatsAppBroadcastRedisConnection()).toThrow(
      "Missing REDIS_URL environment variable"
    )
  })

  it("throws for non-numeric db path", () => {
    process.env.REDIS_URL = "redis://localhost:6379/not-a-db"
    expect(() => getWhatsAppBroadcastRedisConnection()).toThrow(
      'Invalid REDIS_URL database path: "/not-a-db"'
    )
  })

  it("throws for negative db index", () => {
    process.env.REDIS_URL = "redis://localhost:6379/-1"
    expect(() => getWhatsAppBroadcastRedisConnection()).toThrow(
      'Invalid REDIS_URL database path: "/-1"'
    )
  })

  it("throws for invalid port", () => {
    process.env.REDIS_URL = "redis://localhost:0"
    expect(() => getWhatsAppBroadcastRedisConnection()).toThrow(
      "Invalid REDIS_URL port"
    )
  })
})

describe("createWhatsAppBroadcastQueue", () => {
  it("uses injected queue and skips close ownership", async () => {
    const add = mock(async () => ({ id: "job_injected" }))
    const queue = createWhatsAppBroadcastQueue({
      queue: {
        add,
      },
      jobName: "custom-job",
    })

    await queue.enqueue({
      campaignId: "camp_1",
      recipientId: "rec_1",
      method: "dispatch",
    })
    await queue.close()

    expect(add).toHaveBeenCalledWith(
      "custom-job",
      { campaignId: "camp_1", recipientId: "rec_1", method: "dispatch" },
      { jobId: "wa-broadcast:camp_1:rec_1" }
    )
    expect(queueCloseMock).toHaveBeenCalledTimes(0)
  })

  it("creates and closes owned queue when queue is not injected", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/2"

    const queue = createWhatsAppBroadcastQueue({
      queueName: "test-queue",
      defaultJobOptions: { attempts: 5 },
    })

    await queue.enqueue({
      campaignId: "camp_owned",
      recipientId: "rec_owned",
      method: "throttle",
    })
    await queue.close()

    expect(queueConstructorMock).toHaveBeenCalledTimes(1)
    expect(queueConstructorMock).toHaveBeenCalledWith(
      "test-queue",
      expect.objectContaining({
        defaultJobOptions: { attempts: 5 },
      })
    )
    expect(queueAddMock).toHaveBeenCalledWith(
      WHATSAPP_BROADCAST_JOB_NAME,
      {
        campaignId: "camp_owned",
        recipientId: "rec_owned",
        method: "throttle",
      },
      { jobId: "wa-broadcast:camp_owned:rec_owned" }
    )
    expect(queueCloseMock).toHaveBeenCalledTimes(1)
  })

  it("merges default job options with provided options", async () => {
    const add = mock(async () => ({ id: "job_merged" }))
    const queue = createWhatsAppBroadcastQueue({
      queue: { add },
    })

    await queue.enqueue(
      { campaignId: "camp_2", recipientId: "rec_2", method: "dispatch" },
      { attempts: 5 }
    )

    expect(add).toHaveBeenCalledWith(
      WHATSAPP_BROADCAST_JOB_NAME,
      { campaignId: "camp_2", recipientId: "rec_2", method: "dispatch" },
      { jobId: "wa-broadcast:camp_2:rec_2", attempts: 5 }
    )
  })

  it("close does nothing when queue is injected", async () => {
    const add = mock(async () => undefined)
    const queue = createWhatsAppBroadcastQueue({
      queue: { add },
    })

    await queue.close()

    expect(queueCloseMock).toHaveBeenCalledTimes(0)
  })
})

describe("enqueueWhatsAppBroadcast", () => {
  it("reuses shared queue and enqueues with deterministic job ids", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/0"

    await enqueueWhatsAppBroadcast("campaign_a", "recipient_a")
    await enqueueWhatsAppBroadcast("campaign_b", "recipient_b", "throttle")
    await enqueueWhatsAppBroadcast("campaign_c", "recipient_c", "status-update")

    expect(queueConstructorMock).toHaveBeenCalledTimes(1)
    expect(queueAddMock).toHaveBeenCalledTimes(3)
    expect(queueAddMock).toHaveBeenNthCalledWith(
      1,
      WHATSAPP_BROADCAST_JOB_NAME,
      {
        campaignId: "campaign_a",
        recipientId: "recipient_a",
        method: "dispatch",
      },
      { jobId: "wa-broadcast:campaign_a:recipient_a" }
    )
    expect(queueAddMock).toHaveBeenNthCalledWith(
      2,
      WHATSAPP_BROADCAST_JOB_NAME,
      {
        campaignId: "campaign_b",
        recipientId: "recipient_b",
        method: "throttle",
      },
      { jobId: "wa-broadcast:campaign_b:recipient_b" }
    )
    expect(queueAddMock).toHaveBeenNthCalledWith(
      3,
      WHATSAPP_BROADCAST_JOB_NAME,
      {
        campaignId: "campaign_c",
        recipientId: "recipient_c",
        method: "status-update",
      },
      { jobId: "wa-broadcast:campaign_c:recipient_c" }
    )
  })

  it("defaults method to dispatch", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/0"

    await enqueueWhatsAppBroadcast("camp", "rec")

    expect(queueAddMock).toHaveBeenCalledWith(
      WHATSAPP_BROADCAST_JOB_NAME,
      { campaignId: "camp", recipientId: "rec", method: "dispatch" },
      { jobId: "wa-broadcast:camp:rec" }
    )
  })
})

describe("constants", () => {
  it("exports correct queue and job names", () => {
    expect(WHATSAPP_BROADCAST_QUEUE_NAME).toBe("whatsapp-broadcast")
    expect(WHATSAPP_BROADCAST_JOB_NAME).toBe("broadcast-dispatch")
  })
})
