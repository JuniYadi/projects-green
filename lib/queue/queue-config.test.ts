import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import { getQueueRuntimeConfig } from "@/lib/queue/queue-config"

const MANAGED_ENV_KEYS = [
  "NODE_ENV",
  "REDIS_URL",
  "QUEUE_PREFIX",
  "GITHUB_EVENTS_QUEUE_NAME",
] as const

type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number]

let savedEnv: Partial<Record<ManagedEnvKey, string | undefined>> = {}

beforeEach(() => {
  savedEnv = Object.fromEntries(
    MANAGED_ENV_KEYS.map((key) => [key, process.env[key]])
  ) as Partial<Record<ManagedEnvKey, string | undefined>>
})

afterEach(() => {
  for (const key of MANAGED_ENV_KEYS) {
    const value = savedEnv[key]
    if (value === undefined) {
      delete process.env[key]
      continue
    }

    Object.defineProperty(process.env, key, {
      value,
      writable: true,
      configurable: true,
    })
  }
})

describe("getQueueRuntimeConfig", () => {
  test("uses local Redis defaults outside production", () => {
    delete process.env.REDIS_URL
    delete process.env.QUEUE_PREFIX
    delete process.env.GITHUB_EVENTS_QUEUE_NAME
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "test",
      writable: true,
      configurable: true,
    })

    const config = getQueueRuntimeConfig()

    expect(config.redisConnectionLabel).toBe("redis://127.0.0.1:6379/0")
    expect(config.prefix).toBe("pfnapp")
    expect(config.githubEventsQueueName).toBe("github-events")
  })

  test("reads queue config from environment", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    })
    Object.assign(process.env, {
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
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    })

    expect(() => getQueueRuntimeConfig()).toThrow(
      "Missing REDIS_URL environment variable"
    )
  })

  test("throws on invalid Redis protocol", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    })
    Object.assign(process.env, {
      REDIS_URL: "https://example.com",
    })

    expect(() => getQueueRuntimeConfig()).toThrow(
      "REDIS_URL must use redis:// or rediss:// protocol"
    )
  })

  test("throws on invalid Redis DB index (non-numeric)", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    })
    Object.assign(process.env, {
      REDIS_URL: "redis://localhost:6379/abc",
    })

    expect(() => getQueueRuntimeConfig()).toThrow(/non-negative database index/)
  })

  test("throws on invalid Redis URL format", () => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "production",
      writable: true,
      configurable: true,
    })
    Object.assign(process.env, {
      REDIS_URL: "not a url:::://",
    })

    expect(() => getQueueRuntimeConfig()).toThrow(
      "REDIS_URL must be a valid URL"
    )
  })
})
