import { afterEach, describe, expect, it, mock } from "bun:test"

import { createQuotaReconciliationQueue, __testing } from "./quota-reconciliation"

const { parseRedisDb } = __testing

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
      'Expected empty path or numeric DB index.'
    )
  })

  it("throws for negative number (dash fails numeric regex)", () => {
    expect(() => parseRedisDb("/-1")).toThrow(
      'Expected empty path or numeric DB index.'
    )
  })
})

describe("getQuotaReconciliationRedisConnection", () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it("throws when REDIS_URL is not set", async () => {
    const { getQuotaReconciliationRedisConnection } = await import("./quota-reconciliation")
    delete process.env.REDIS_URL

    expect(() => getQuotaReconciliationRedisConnection()).toThrow(
      "Missing REDIS_URL environment variable"
    )
  })

  it("parses REDIS_URL and returns connection config", async () => {
    const { getQuotaReconciliationRedisConnection } = await import("./quota-reconciliation")
    process.env.REDIS_URL = "redis://user:pass@localhost:6379/5"

    const config = getQuotaReconciliationRedisConnection()

    expect(config.host).toBe("localhost")
    expect(config.port).toBe(6379)
    expect(config.username).toBe("user")
    expect(config.password).toBe("pass")
    expect(config.db).toBe(5)
    expect(config.tls).toBeUndefined()
  })

  it("enables TLS for rediss:// protocol", async () => {
    const { getQuotaReconciliationRedisConnection } = await import("./quota-reconciliation")
    process.env.REDIS_URL = "rediss://localhost:6380"

    const config = getQuotaReconciliationRedisConnection()

    expect(config.tls).toEqual({})
    expect(config.port).toBe(6380)
  })

  it("throws for invalid port", async () => {
    const { getQuotaReconciliationRedisConnection } = await import("./quota-reconciliation")
    process.env.REDIS_URL = "redis://localhost:invalid"

    expect(() => getQuotaReconciliationRedisConnection()).toThrow()
  })

  it("uses default port 6379 when not specified", async () => {
    const { getQuotaReconciliationRedisConnection } = await import("./quota-reconciliation")
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
})
