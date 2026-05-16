import { afterEach, describe, expect, it } from "bun:test"

import { getGithubEventsRedisConnection } from "@/lib/queue/github-events"

const originalRedisUrl = process.env.REDIS_URL

afterEach(() => {
  if (originalRedisUrl === undefined) {
    delete process.env.REDIS_URL
    return
  }

  process.env.REDIS_URL = originalRedisUrl
})

describe("getGithubEventsRedisConnection", () => {
  it("uses db 0 when REDIS_URL has no explicit DB path", () => {
    process.env.REDIS_URL = "redis://localhost:6379"

    const connection = getGithubEventsRedisConnection()

    expect(connection.db).toBe(0)
  })

  it("throws for malformed REDIS_URL DB path", () => {
    process.env.REDIS_URL = "redis://localhost:6379/not-a-db"

    expect(() => getGithubEventsRedisConnection()).toThrow(
      'Invalid REDIS_URL database path: "/not-a-db"'
    )
  })
})
