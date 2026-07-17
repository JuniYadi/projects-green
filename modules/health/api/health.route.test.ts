import { describe, expect, it, mock, beforeEach } from "bun:test"

// Mock dependencies before imports
const mockPrismaQueryRaw = mock()
const mockRedisPing = mock()

mock.module("@/lib/prisma", () => ({
  prisma: { $queryRaw: mockPrismaQueryRaw },
}))

mock.module("@/lib/redis", () => ({
  redis: { ping: mockRedisPing },
}))

const { healthRoutes } = await import("./health.route")
const { markStartupComplete } = await import(
  "@/modules/health/health.service"
)

const BASE = "http://localhost"

beforeEach(() => {
  mockPrismaQueryRaw.mockClear()
  mockRedisPing.mockClear()
  mockPrismaQueryRaw.mockResolvedValue([{ "?column?": 1 }])
  mockRedisPing.mockResolvedValue("PONG")
})

describe("healthRoutes", () => {
  describe("GET /healthz (overall)", () => {
    it("returns healthy with uptime", async () => {
      const res = await healthRoutes.handle(
        new Request(`${BASE}/healthz`)
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.healthy).toBe(true)
      expect(body.uptime).toBeTypeOf("number")
    })
  })

  describe("GET /healthz/live (liveness)", () => {
    it("returns healthy with app check", async () => {
      const res = await healthRoutes.handle(
        new Request(`${BASE}/healthz/live`)
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.healthy).toBe(true)
      expect(body.checks?.app?.healthy).toBe(true)
    })
  })

  describe("GET /healthz/ready (readiness)", () => {
    it("returns healthy when DB and Redis are up", async () => {
      const res = await healthRoutes.handle(
        new Request(`${BASE}/healthz/ready`)
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.healthy).toBe(true)
      expect(body.checks?.dependencies?.healthy).toBe(true)
      expect(body.checks?.dependencies?.details).toEqual({
        database: "healthy",
        redis: "healthy",
      })
    })

    it("returns 503 when DB is down", async () => {
      mockPrismaQueryRaw.mockRejectedValue(new Error("connection refused"))

      const res = await healthRoutes.handle(
        new Request(`${BASE}/healthz/ready`)
      )
      const body = await res.json()

      expect(res.status).toBe(503)
      expect(body.healthy).toBe(false)
      expect(body.checks?.dependencies?.details?.database).toBe("unhealthy")
    })

    it("returns 503 when Redis is down", async () => {
      mockRedisPing.mockRejectedValue(new Error("ECONNREFUSED"))

      const res = await healthRoutes.handle(
        new Request(`${BASE}/healthz/ready`)
      )
      const body = await res.json()

      expect(res.status).toBe(503)
      expect(body.healthy).toBe(false)
      expect(body.checks?.dependencies?.details?.redis).toBe("unhealthy")
    })
  })

  describe("GET /health/startup", () => {
    it("returns ok after startup completes", async () => {
      markStartupComplete()
      const res = await healthRoutes.handle(
        new Request(`${BASE}/health/startup`)
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
    })
  })

  describe("GET /health/liveness (compat)", () => {
    it("returns ok", async () => {
      const res = await healthRoutes.handle(
        new Request(`${BASE}/health/liveness`)
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.timestamp).toBeTypeOf("string")
    })
  })

  describe("GET /health/readiness (compat)", () => {
    it("returns ok when dependencies are healthy", async () => {
      const res = await healthRoutes.handle(
        new Request(`${BASE}/health/readiness`)
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.checks).toEqual({
        database: "healthy",
        redis: "healthy",
      })
    })

    it("returns 503 when dependencies are unhealthy", async () => {
      mockPrismaQueryRaw.mockRejectedValue(new Error("connection refused"))

      const res = await healthRoutes.handle(
        new Request(`${BASE}/health/readiness`)
      )
      const body = await res.json()

      expect(res.status).toBe(503)
      expect(body.ok).toBe(false)
      expect(body.checks?.database).toBe("unhealthy")
    })
  })

  describe("GET /health/webhooks", () => {
    it("returns healthy when no alerts", async () => {
      const res = await healthRoutes.handle(
        new Request(`${BASE}/health/webhooks`)
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.metrics).toBeDefined()
      expect(body.alerts).toEqual([])
    })
  })
})
