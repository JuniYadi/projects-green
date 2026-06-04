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
    data: Record<string, unknown>,
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
  QUOTA_RECONCILIATION_JOB,
  QUOTA_RECONCILIATION_QUEUE,
  __testing,
  createQuotaReconciliationQueue,
  enqueueQuotaReconciliation,
  getQuotaReconciliationRedisConnection,
} = await import("./quota-reconciliation")

const { parseRedisDb } = __testing

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

describe("parseRedisDb", () => {
  it("returns 0 for empty path", () => {
    expect(parseRedisDb("")).toBe(0)
  })

  it("returns 0 for root path", () => {
    expect(parseRedisDb("/")).toBe(0)
  })

  it("parses numeric db index", () => {
    expect(parseRedisDb("/5")).toBe(5)
    expect(parseRedisDb("/0")).toBe(0)
    expect(parseRedisDb("/15")).toBe(15)
  })

  it("throws for non-numeric path", () => {
    expect(() => parseRedisDb("/abc")).toThrow(
      "Expected empty path or numeric DB index."
    )
  })

  it("throws for negative number (dash fails numeric regex)", () => {
    expect(() => parseRedisDb("/-1")).toThrow(
      "Expected empty path or numeric DB index."
    )
  })
})

describe("getQuotaReconciliationRedisConnection", () => {
  it("throws when REDIS_URL is not set", () => {
    delete process.env.REDIS_URL

    expect(() => getQuotaReconciliationRedisConnection()).toThrow(
      "Missing REDIS_URL environment variable"
    )
  })

  it("parses REDIS_URL and returns connection config", () => {
    process.env.REDIS_URL = "redis://user:pass@localhost:6379/5"

    const config = getQuotaReconciliationRedisConnection()

    expect(config.host).toBe("localhost")
    expect(config.port).toBe(6379)
    expect(config.username).toBe("user")
    expect(config.password).toBe("pass")
    expect(config.db).toBe(5)
    expect(config.tls).toBeUndefined()
  })

  it("enables TLS for rediss:// protocol", () => {
    process.env.REDIS_URL = "rediss://localhost:6380"

    const config = getQuotaReconciliationRedisConnection()

    expect(config.tls).toEqual({})
    expect(config.port).toBe(6380)
  })

  it("throws for invalid port", () => {
    process.env.REDIS_URL = "redis://localhost:invalid"

    expect(() => getQuotaReconciliationRedisConnection()).toThrow()
  })

  it("uses default port 6379 when not specified", () => {
    process.env.REDIS_URL = "redis://localhost"

    const config = getQuotaReconciliationRedisConnection()

    expect(config.port).toBe(6379)
  })
})

describe("createQuotaReconciliationQueue", () => {
  it("creates a queue with injected add function", async () => {
    const add = mock().mockResolvedValue(undefined)
    const queue = createQuotaReconciliationQueue({
      queue: { add },
    })

    expect(queue).toHaveProperty("enqueue")
    expect(queue).toHaveProperty("close")

    await queue.enqueue({
      organizationId: "org-1",
      deviceId: "dev-1",
      direction: "IN",
      messageId: "msg-1",
      timestamp: "2025-01-01T00:00:00.000Z",
    })

    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith(
      "quota-reconciliation-job",
      {
        organizationId: "org-1",
        deviceId: "dev-1",
        direction: "IN",
        messageId: "msg-1",
        timestamp: "2025-01-01T00:00:00.000Z",
      },
      expect.objectContaining({
        jobId: "quota-recon:org-1:dev-1:msg-1",
      })
    )
  })

  it("close is a no-op when queue is injected", async () => {
    const add = mock().mockResolvedValue(undefined)
    const queue = createQuotaReconciliationQueue({
      queue: { add },
    })

    await expect(queue.close()).resolves.toBeUndefined()
  })

  it("creates and closes owned queue when queue is not injected", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/2"

    const queue = createQuotaReconciliationQueue({ queueName: "owned-queue" })

    await queue.enqueue({
      organizationId: "org-owned",
      deviceId: "dev-owned",
      direction: "OUT",
      messageId: "msg-owned",
      timestamp: "2025-06-01T00:00:00.000Z",
    })

    await queue.close()

    expect(queueConstructorMock).toHaveBeenCalledTimes(1)
    expect(queueConstructorMock).toHaveBeenCalledWith(
      "owned-queue",
      expect.objectContaining({
        connection: expect.objectContaining({ db: 2 }),
      })
    )
    expect(queueAddMock).toHaveBeenCalledWith(
      "quota-reconciliation-job",
      {
        organizationId: "org-owned",
        deviceId: "dev-owned",
        direction: "OUT",
        messageId: "msg-owned",
        timestamp: "2025-06-01T00:00:00.000Z",
      },
      expect.objectContaining({
        jobId: "quota-recon:org-owned:dev-owned:msg-owned",
      })
    )
    expect(queueCloseMock).toHaveBeenCalledTimes(1)
  })

  it("uses custom job name and default job options", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/0"

    const queue = createQuotaReconciliationQueue({
      queueName: "custom-queue",
      jobName: "custom-job",
    })

    await queue.enqueue({
      organizationId: "org-custom",
      deviceId: "dev-custom",
      direction: "IN",
      messageId: "msg-custom",
      timestamp: "2025-06-01T00:00:00.000Z",
    })

    expect(queueConstructorMock).toHaveBeenCalledWith(
      "custom-queue",
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          backoff: expect.objectContaining({
            type: "exponential",
            delay: 5_000,
          }),
        }),
      })
    )
    expect(queueAddMock).toHaveBeenCalledWith(
      "custom-job",
      expect.any(Object),
      expect.any(Object)
    )
  })
})

describe("enqueueQuotaReconciliation", () => {
  it("reuses shared queue and enqueues with deterministic job ids", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/0"

    await enqueueQuotaReconciliation(
      "org-1",
      "dev-1",
      "IN",
      "msg-1",
      new Date("2025-06-01T12:00:00.000Z")
    )

    await enqueueQuotaReconciliation(
      "org-1",
      "dev-2",
      "OUT",
      "msg-2",
      new Date("2025-06-01T12:30:00.000Z")
    )

    expect(queueConstructorMock).toHaveBeenCalledTimes(1)
    expect(queueConstructorMock).toHaveBeenCalledWith(
      QUOTA_RECONCILIATION_QUEUE,
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
        }),
      })
    )
    expect(queueAddMock).toHaveBeenCalledTimes(2)
    expect(queueAddMock).toHaveBeenNthCalledWith(
      1,
      QUOTA_RECONCILIATION_JOB,
      {
        organizationId: "org-1",
        deviceId: "dev-1",
        direction: "IN",
        messageId: "msg-1",
        timestamp: "2025-06-01T12:00:00.000Z",
      },
      undefined
    )
    expect(queueAddMock).toHaveBeenNthCalledWith(
      2,
      QUOTA_RECONCILIATION_JOB,
      {
        organizationId: "org-1",
        deviceId: "dev-2",
        direction: "OUT",
        messageId: "msg-2",
        timestamp: "2025-06-01T12:30:00.000Z",
      },
      undefined
    )
  })

  it("uses current date when timestamp is not provided", async () => {
    process.env.REDIS_URL = "redis://localhost:6379/0"

    const before = new Date()
    await enqueueQuotaReconciliation("org-now", "dev-now", "IN", "msg-now")
    const after = new Date()

    expect(queueAddMock).toHaveBeenCalledTimes(1)
    const callArg = queueAddMock.mock.calls[0][1]

    expect(callArg.organizationId).toBe("org-now")
    expect(callArg.deviceId).toBe("dev-now")
    expect(callArg.direction).toBe("IN")
    expect(callArg.messageId).toBe("msg-now")

    // Timestamp should be an ISO string within the test window
    const parsedTimestamp = new Date(callArg.timestamp).getTime()
    expect(parsedTimestamp).toBeGreaterThanOrEqual(before.getTime())
    expect(parsedTimestamp).toBeLessThanOrEqual(after.getTime())
  })
})
