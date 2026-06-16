import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test"

const redisStore = new Map<string, string>()
const mockRedisGet = mock(async (key: string) => redisStore.get(key) ?? null)
const mockRedisSet = mock(
  async (key: string, value: string, mode: string, ttl: number) => {
    redisStore.set(key, value)
    return { key, value, mode, ttl }
  }
)
const mockRedisDel = mock(async (...keys: string[]) => {
  for (const key of keys) {
    redisStore.delete(key)
  }
  return keys.length
})
const mockRedisScan = mock(async () => {
  return [
    "0",
    [...redisStore.keys()].filter((key) => key.startsWith("wa:idempotency:")),
  ] as [string, string[]]
})

mock.module("ioredis", () => ({
  default: class MockRedis {
    status = "ready"
    connect = mock(async () => {})
    get = mockRedisGet
    set = mockRedisSet
    del = mockRedisDel
    scan = mockRedisScan
  },
}))

const {
  hasProcessedEvent,
  markEventProcessed,
  resetIdempotencyStore,
  __testing,
} = await import("./idempotency-repository")

const originalRedisUrl = process.env.REDIS_URL

beforeEach(() => {
  process.env.REDIS_URL = "redis://localhost:6379/0"
  redisStore.clear()
  mockRedisGet.mockClear()
  mockRedisSet.mockClear()
  mockRedisDel.mockClear()
  mockRedisScan.mockClear()
  __testing.resetRedisClient()
})

afterEach(() => {
  if (originalRedisUrl === undefined) {
    delete process.env.REDIS_URL
  } else {
    process.env.REDIS_URL = originalRedisUrl
  }
})

describe("whatsapp idempotency repository", () => {
  it("checks processed events with Redis GET", async () => {
    redisStore.set("wa:idempotency:evt-1", "1")

    await expect(hasProcessedEvent("evt-1")).resolves.toBe(true)
    await expect(hasProcessedEvent("evt-2")).resolves.toBe(false)

    expect(mockRedisGet).toHaveBeenCalledWith("wa:idempotency:evt-1")
    expect(mockRedisGet).toHaveBeenCalledWith("wa:idempotency:evt-2")
  })

  it("marks events processed with Redis SET EX and a one day TTL", async () => {
    await markEventProcessed("evt-1")

    expect(mockRedisSet).toHaveBeenCalledWith(
      "wa:idempotency:evt-1",
      "1",
      "EX",
      86_400
    )
    expect(redisStore.get("wa:idempotency:evt-1")).toBe("1")
  })

  it("resets idempotency keys by scanning and deleting the prefix", async () => {
    redisStore.set("wa:idempotency:evt-1", "1")
    redisStore.set("wa:idempotency:evt-2", "1")
    redisStore.set("other:key", "1")

    await resetIdempotencyStore()

    expect(mockRedisScan).toHaveBeenCalledWith(
      "0",
      "MATCH",
      "wa:idempotency:*",
      "COUNT",
      100
    )
    expect(mockRedisDel).toHaveBeenCalledWith(
      "wa:idempotency:evt-1",
      "wa:idempotency:evt-2"
    )
    expect(redisStore.has("wa:idempotency:evt-1")).toBe(false)
    expect(redisStore.has("wa:idempotency:evt-2")).toBe(false)
    expect(redisStore.has("other:key")).toBe(true)
  })

  it("falls back to in-memory storage when Redis configuration is unavailable", async () => {
    delete process.env.REDIS_URL
    __testing.resetRedisClient()
    const warn = spyOn(console, "warn").mockImplementation(() => {})

    await markEventProcessed("evt-fallback")

    await expect(hasProcessedEvent("evt-fallback")).resolves.toBe(true)
    expect(warn).toHaveBeenCalled()

    warn.mockRestore()
  })

  it("falls back to in-memory storage when Redis commands fail", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {})
    mockRedisSet.mockImplementationOnce(async () => {
      throw new Error("redis down")
    })
    mockRedisGet.mockImplementationOnce(async () => {
      throw new Error("redis down")
    })

    await markEventProcessed("evt-error")

    await expect(hasProcessedEvent("evt-error")).resolves.toBe(true)
    expect(warn).toHaveBeenCalled()

    warn.mockRestore()
  })
})
