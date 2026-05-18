/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const queueAddMock = mock(async () => ({ id: "job_1" }))
const queueCloseMock = mock(async () => undefined)
const queueConstructorMock = mock((...args: unknown[]) => {
  void args
})

class QueueMock {
  constructor(name: string, options: Record<string, unknown>) {
    queueConstructorMock(name, options)
  }

  async add(
    name: string,
    data: { eventId: string },
    opts?: Record<string, unknown>
  ) {
    return queueAddMock(name, data, opts)
  }

  async close() {
    return queueCloseMock()
  }
}

mock.module("bullmq", () => ({ Queue: QueueMock }))

const {
  __testing,
  createGithubEventsQueue,
  enqueueGithubWebhookEvent,
  getGithubEventsRedisConnection,
} = await import("@/lib/queue/github-events")

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

describe("getGithubEventsRedisConnection", () => {
  it("uses db 0 when REDIS_URL has no explicit DB path", () => {
    process.env.REDIS_URL = "redis://localhost:6379"

    const connection = getGithubEventsRedisConnection()

    expect(connection.db).toBe(0)
    expect(connection.port).toBe(6379)
    expect(connection.tls).toBeUndefined()
  })

  it("parses auth, db index, and rediss tls", () => {
    process.env.REDIS_URL = "rediss://alice:secret@cache.example.com:6380/5"

    const connection = getGithubEventsRedisConnection()

    expect(connection).toMatchObject({
      host: "cache.example.com",
      port: 6380,
      username: "alice",
      password: "secret",
      db: 5,
    })
    expect(connection.tls).toEqual({})
  })

  it("throws for missing env, malformed db path, and invalid port", () => {
    delete process.env.REDIS_URL
    expect(() => getGithubEventsRedisConnection()).toThrow(
      "Missing REDIS_URL environment variable"
    )

    process.env.REDIS_URL = "redis://localhost:6379/not-a-db"
    expect(() => getGithubEventsRedisConnection()).toThrow(
      'Invalid REDIS_URL database path: "/not-a-db"'
    )

    process.env.REDIS_URL = "redis://localhost:0"
    expect(() => getGithubEventsRedisConnection()).toThrow(
      "Invalid REDIS_URL port"
    )
  })
})

describe("createGithubEventsQueue", () => {
  it("uses injected queue and skips close ownership", async () => {
    const add = mock(async () => ({ id: "job_injected" }))
    const queue = createGithubEventsQueue({
      queue: {
        add,
      },
      jobName: "custom-job",
    })

    await queue.enqueue({ eventId: "evt_1" })
    await queue.close()

    expect(add).toHaveBeenCalledWith(
      "custom-job",
      { eventId: "evt_1" },
      { jobId: "github-event:evt_1" }
    )
    expect(queueCloseMock).toHaveBeenCalledTimes(0)
  })

  it("creates and closes owned queue when queue is not injected", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/2"

    const queue = createGithubEventsQueue({ queueName: "owned-queue" })

    await queue.enqueue({ eventId: "evt_owned" })
    await queue.close()

    expect(queueConstructorMock).toHaveBeenCalledTimes(1)
    expect(queueConstructorMock).toHaveBeenCalledWith(
      "owned-queue",
      expect.objectContaining({
        connection: expect.objectContaining({ db: 2 }),
      })
    )
    expect(queueAddMock).toHaveBeenCalledWith(
      "process-github-webhook-event",
      { eventId: "evt_owned" },
      { jobId: "github-event:evt_owned" }
    )
    expect(queueCloseMock).toHaveBeenCalledTimes(1)
  })
})

describe("enqueueGithubWebhookEvent", () => {
  it("reuses shared queue and enqueues with deterministic job ids", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/0"

    await enqueueGithubWebhookEvent("event_a")
    await enqueueGithubWebhookEvent("event_b")

    expect(queueConstructorMock).toHaveBeenCalledTimes(1)
    expect(queueAddMock).toHaveBeenCalledTimes(2)
    expect(queueAddMock).toHaveBeenNthCalledWith(
      1,
      "process-github-webhook-event",
      { eventId: "event_a" },
      { jobId: "github-event:event_a" }
    )
    expect(queueAddMock).toHaveBeenNthCalledWith(
      2,
      "process-github-webhook-event",
      { eventId: "event_b" },
      { jobId: "github-event:event_b" }
    )
  })
})
