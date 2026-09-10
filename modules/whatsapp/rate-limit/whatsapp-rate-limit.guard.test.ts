import { describe, it, expect, beforeEach, mock, setSystemTime } from "bun:test"
import { Elysia } from "elysia"
import {
  classifyWhatsappRouteTier,
  evaluateWhatsappRateLimit,
  resetWhatsappRateLimitStore,
  setTestingRedisClient,
  whatsappRateLimitPlugin,
  WHATSAPP_RATE_LIMIT_TIERS,
  type RedisClient,
} from "./whatsapp-rate-limit.guard"

describe("classifyWhatsappRouteTier", () => {
  it("exempts Meta webhooks and rate limit status", () => {
    expect(classifyWhatsappRouteTier("/whatsapp/webhooks", "POST", true)).toBe(
      "exempt"
    )
    expect(
      classifyWhatsappRouteTier("/whatsapp/webhooks/incoming", "POST", false)
    ).toBe("exempt")
    expect(
      classifyWhatsappRouteTier("/whatsapp/meta-webhook/secret", "POST", false)
    ).toBe("exempt")
    expect(
      classifyWhatsappRouteTier("/whatsapp/rate-limit/status", "GET", true)
    ).toBe("exempt")
  })

  it("classifies unauthenticated callers as anonymous tier (15 RPM)", () => {
    expect(classifyWhatsappRouteTier("/whatsapp/messages", "POST", false)).toBe(
      "anonymous"
    )
    expect(classifyWhatsappRouteTier("/whatsapp/contacts", "GET", false)).toBe(
      "anonymous"
    )
  })

  it("classifies POST messages as messaging tier (120 RPM)", () => {
    expect(classifyWhatsappRouteTier("/whatsapp/messages", "POST", true)).toBe(
      "messaging"
    )
    expect(
      classifyWhatsappRouteTier("/whatsapp/messages/send", "POST", true)
    ).toBe("messaging")
    expect(
      classifyWhatsappRouteTier(
        "/whatsapp/messages/send-template",
        "POST",
        true
      )
    ).toBe("messaging")
    expect(
      classifyWhatsappRouteTier(
        "/whatsapp/messages/send-interactive",
        "POST",
        true
      )
    ).toBe("messaging")
    expect(
      classifyWhatsappRouteTier("/whatsapp/workflow/trigger", "POST", true)
    ).toBe("messaging")
  })

  it("classifies heavy Meta Graph operations as heavy tier (30 RPM)", () => {
    expect(
      classifyWhatsappRouteTier("/whatsapp/media/upload", "POST", true)
    ).toBe("heavy")
    expect(classifyWhatsappRouteTier("/whatsapp/templates", "POST", true)).toBe(
      "heavy"
    )
    expect(
      classifyWhatsappRouteTier("/whatsapp/templates/hello", "DELETE", true)
    ).toBe("heavy")
    expect(
      classifyWhatsappRouteTier(
        "/whatsapp/devices/dev-1/profile",
        "PATCH",
        true
      )
    ).toBe("heavy")
    expect(
      classifyWhatsappRouteTier("/whatsapp/devices/dev-1/token", "POST", true)
    ).toBe("heavy")
    expect(
      classifyWhatsappRouteTier("/whatsapp/broadcasts", "POST", true)
    ).toBe("heavy")
  })

  it("classifies standard CRUD requests as standard tier (60 RPM)", () => {
    expect(classifyWhatsappRouteTier("/whatsapp/contacts", "GET", true)).toBe(
      "standard"
    )
    expect(classifyWhatsappRouteTier("/whatsapp/contacts", "POST", true)).toBe(
      "standard"
    )
    expect(
      classifyWhatsappRouteTier("/whatsapp/conversations", "GET", true)
    ).toBe("standard")
    expect(classifyWhatsappRouteTier("/whatsapp/devices", "GET", true)).toBe(
      "standard"
    )
    expect(classifyWhatsappRouteTier("/whatsapp/messages", "GET", true)).toBe(
      "standard"
    )
    expect(classifyWhatsappRouteTier("/whatsapp/templates", "GET", true)).toBe(
      "standard"
    )
  })

  it("handles paths with trailing slashes and normalized formats", () => {
    expect(classifyWhatsappRouteTier("/whatsapp/messages/", "POST", true)).toBe(
      "messaging"
    )
    expect(classifyWhatsappRouteTier("/whatsapp/webhooks/", "POST", true)).toBe(
      "exempt"
    )
  })
})

describe("evaluateWhatsappRateLimit (In-Memory Engine)", () => {
  beforeEach(() => {
    resetWhatsappRateLimitStore()
  })

  it("allows up to max and rejects when limit is exceeded", async () => {
    const custom = { windowMs: 10_000, max: 3, name: "Test" }

    const res1 = await evaluateWhatsappRateLimit("key-1", "standard", custom)
    expect(res1.allowed).toBe(true)
    expect(res1.remaining).toBe(2)

    const res2 = await evaluateWhatsappRateLimit("key-1", "standard", custom)
    expect(res2.allowed).toBe(true)
    expect(res2.remaining).toBe(1)

    const res3 = await evaluateWhatsappRateLimit("key-1", "standard", custom)
    expect(res3.allowed).toBe(true)
    expect(res3.remaining).toBe(0)

    const res4 = await evaluateWhatsappRateLimit("key-1", "standard", custom)
    expect(res4.allowed).toBe(false)
    expect(res4.remaining).toBe(0)
  })

  it("isolates different tenant keys independently", async () => {
    const custom = { windowMs: 10_000, max: 2, name: "Test" }

    await evaluateWhatsappRateLimit("org-1", "standard", custom)
    await evaluateWhatsappRateLimit("org-1", "standard", custom)
    const org1Over = await evaluateWhatsappRateLimit(
      "org-1",
      "standard",
      custom
    )
    expect(org1Over.allowed).toBe(false)

    const org2First = await evaluateWhatsappRateLimit(
      "org-2",
      "standard",
      custom
    )
    expect(org2First.allowed).toBe(true)
    expect(org2First.remaining).toBe(1)
  })

  it("has correct configuration values matching specifications", () => {
    expect(WHATSAPP_RATE_LIMIT_TIERS.messaging.max).toBe(120)
    expect(WHATSAPP_RATE_LIMIT_TIERS.standard.max).toBe(60)
    expect(WHATSAPP_RATE_LIMIT_TIERS.heavy.max).toBe(30)
    expect(WHATSAPP_RATE_LIMIT_TIERS.anonymous.max).toBe(15)
  })

  it("cleans up expired timestamps and triggers periodic memory cleanup", async () => {
    const custom = { windowMs: 50, max: 10, name: "Short" }

    // First request
    await evaluateWhatsappRateLimit("exp-1", "standard", custom)
    // Advance system time deterministically past expiration
    setSystemTime(new Date(Date.now() + 100))
    const res = await evaluateWhatsappRateLimit("exp-1", "standard", custom)
    expect(res.allowed).toBe(true)
    expect(res.remaining).toBe(9)

    // Run 100 requests to trigger cleanupCounter % 100 === 0
    for (let i = 0; i < 105; i++) {
      await evaluateWhatsappRateLimit(`cleanup-${i}`, "standard", custom)
    }
  })
})

describe("evaluateWhatsappRateLimit (Redis Engine & Fallback)", () => {
  beforeEach(() => {
    resetWhatsappRateLimitStore()
  })

  it("evaluates rate limits using Redis pipeline when Redis is ready", async () => {
    const mockZremrangebyscore = mock(() => {})
    const mockZcard = mock(() => {})
    const mockZadd = mock(() => {})
    const mockPexpire = mock(() => {})
    const mockZrem = mock(async () => 1)

    const mockPipeline = {
      zremrangebyscore: mockZremrangebyscore,
      zcard: mockZcard,
      zadd: mockZadd,
      pexpire: mockPexpire,
      exec: mock(async () => [
        [null, 0],
        [null, 5], // currentCount = 5
        [null, 1],
        [null, 1],
      ]),
    }

    const mockRedis = {
      status: "ready",
      pipeline: () => mockPipeline,
      zrem: mockZrem,
    } as unknown as RedisClient
    setTestingRedisClient(mockRedis)

    const custom = { windowMs: 60_000, max: 10, name: "RedisTest" }
    const result = await evaluateWhatsappRateLimit(
      "redis-key",
      "standard",
      custom
    )

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4) // 10 - 5 - 1 = 4
    expect(result.limit).toBe(10)
    expect(result.tier).toBe("standard")
  })

  it("blocks requests and rolls back member when Redis count exceeds max", async () => {
    const mockZrem = mock(async () => 1)
    const mockPipeline = {
      zremrangebyscore: mock(() => {}),
      zcard: mock(() => {}),
      zadd: mock(() => {}),
      pexpire: mock(() => {}),
      exec: mock(async () => [
        [null, 0],
        [null, 10], // currentCount = 10 (at or over capacity of max 10)
        [null, 1],
        [null, 1],
      ]),
    }

    const mockRedis = {
      status: "ready",
      pipeline: () => mockPipeline,
      zrem: mockZrem,
    } as unknown as RedisClient
    setTestingRedisClient(mockRedis)

    const custom = { windowMs: 60_000, max: 10, name: "RedisOver" }
    const result = await evaluateWhatsappRateLimit(
      "redis-over",
      "standard",
      custom
    )

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(mockZrem).toHaveBeenCalled()
  })

  it("falls back to in-memory store when Redis pipeline execution throws", async () => {
    const mockPipeline = {
      zremrangebyscore: mock(() => {}),
      zcard: mock(() => {}),
      zadd: mock(() => {}),
      pexpire: mock(() => {}),
      exec: mock(async () => {
        throw new Error("Redis connection dropped")
      }),
    }

    const mockRedis = {
      status: "ready",
      pipeline: () => mockPipeline,
      zrem: mock(async () => 1),
    } as unknown as RedisClient
    setTestingRedisClient(mockRedis)

    const custom = { windowMs: 60_000, max: 5, name: "RedisErr" }
    const result = await evaluateWhatsappRateLimit(
      "redis-err",
      "standard",
      custom
    )

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4) // Succeeded via in-memory fallback
  })
})

describe("whatsappRateLimitPlugin (Elysia Integration)", () => {
  beforeEach(() => {
    resetWhatsappRateLimitStore()
  })

  it("allows requests under the limit and adds rate limit headers", async () => {
    const app = new Elysia({ prefix: "/whatsapp" })
      .use(whatsappRateLimitPlugin)
      .get("/contacts", () => ({ ok: true }))

    const res = await app.handle(
      new Request("http://localhost/whatsapp/contacts", {
        headers: { "x-workos-session-org": "org-test" },
      })
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("X-RateLimit-Limit")).toBe("15") // anonymous without full session
    expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined()
    expect(res.headers.get("X-RateLimit-Reset")).toBeDefined()
  })

  it("returns 429 with RATE_LIMITED error body and Retry-After header when threshold reached", async () => {
    const app = new Elysia({ prefix: "/whatsapp" })
      .use(whatsappRateLimitPlugin)
      .get("/ping", () => ({ ok: true }))

    // Anonymous limit is 15 requests
    for (let i = 0; i < 15; i++) {
      const res = await app.handle(
        new Request("http://localhost/whatsapp/ping", {
          headers: { "x-forwarded-for": "198.51.100.1" },
        })
      )
      expect(res.status).toBe(200)
    }

    // 16th request must be rate-limited
    const overRes = await app.handle(
      new Request("http://localhost/whatsapp/ping", {
        headers: { "x-forwarded-for": "198.51.100.1" },
      })
    )

    expect(overRes.status).toBe(429)
    expect(overRes.headers.get("Retry-After")).toBeDefined()
    expect(overRes.headers.get("X-RateLimit-Remaining")).toBe("0")

    const body = await overRes.json()
    expect(body.error.code).toBe("RATE_LIMITED")
    expect(body.error.details.tier).toBe("anonymous")
    expect(body.error.details.limit).toBe(15)
  })

  it("does not throttle exempt webhook routes", async () => {
    const app = new Elysia({ prefix: "/whatsapp" })
      .use(whatsappRateLimitPlugin)
      .post("/webhooks", () => ({ ok: "webhook" }))

    for (let i = 0; i < 20; i++) {
      const res = await app.handle(
        new Request("http://localhost/whatsapp/webhooks", {
          method: "POST",
          headers: { "x-forwarded-for": "203.0.113.1" },
        })
      )
      expect(res.status).toBe(200)
    }
  })
})
