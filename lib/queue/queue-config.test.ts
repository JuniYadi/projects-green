import { afterEach, describe, expect, test } from "bun:test"

import { getQueueRuntimeConfig } from "@/lib/queue/queue-config"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("getQueueRuntimeConfig", () => {
  test("uses local Redis defaults outside production", () => {
    delete process.env.REDIS_URL
    delete process.env.QUEUE_PREFIX
    delete process.env.GITHUB_EVENTS_QUEUE_NAME
    Object.assign(process.env, {
      NODE_ENV: "test",
    })

    const config = getQueueRuntimeConfig()

    expect(config.redisConnectionLabel).toBe("redis://127.0.0.1:6379/0")
    expect(config.prefix).toBe("pfnapp")
    expect(config.githubEventsQueueName).toBe("github-events")
  })

  test("reads queue config from environment", () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      REDIS_URL: "rediss://:s3cr3t@example-redis:6380/4",
      QUEUE_PREFIX: "platform",
      GITHUB_EVENTS_QUEUE_NAME: "github-webhooks",
    })

    const config = getQueueRuntimeConfig()

    expect(config.redisConnectionLabel).toBe("rediss://example-redis:6380/4")
    expect(config.prefix).toBe("platform")
    expect(config.githubEventsQueueName).toBe("github-webhooks")
  })

  test("throws when REDIS_URL is missing in production", () => {
    delete process.env.REDIS_URL
    Object.assign(process.env, {
      NODE_ENV: "production",
    })

    expect(() => getQueueRuntimeConfig()).toThrow(
      "Missing REDIS_URL environment variable"
    )
  })

  test("throws on invalid Redis protocol", () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      REDIS_URL: "https://example.com",
    })

    expect(() => getQueueRuntimeConfig()).toThrow(
      "REDIS_URL must use redis:// or rediss:// protocol"
    )
  })
})
