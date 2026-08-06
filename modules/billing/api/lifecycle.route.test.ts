import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type { MockAuthContext } from "@/test/helpers/test-auth"

const mockFindBillingAccount = mock()
const mockFindFirst = mock()
const mockUpdate = mock()
const mockFindUnique = mock()
const mockServicePricingFindUnique = mock()
const mockBillingAccountFindUnique = mock()
const mockAuditCreate = mock()

const mockPrismaClient = {
  billingAccount: {
    findUnique: mockFindBillingAccount,
  },
  serviceSubscription: {
    findFirst: mockFindFirst,
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
  servicePricing: {
    findUnique: mockServicePricingFindUnique,
  },
  billingAuditLog: {
    create: mockAuditCreate,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))
const { createLifecycleRoutes } = await import("./lifecycle.route")

const SUB_ID = "11111111-1111-4111-8111-111111111111"
const TENANT_ID = "22222222-2222-4222-8222-222222222222"
const PRICING_ID = "44444444-4444-4444-8444-444444444444"

const defaultAuth: MockAuthContext = {
  user: { id: "user-1", email: "user@test.com" },
  organizationId: "org-1",
}

const baseSub = {
  id: SUB_ID,
  organizationId: TENANT_ID,
  status: "ACTIVE",
  billingPeriod: "MONTHLY",
  pricingId: PRICING_ID,
  currentPeriodStart: new Date("2026-06-01"),
  currentPeriodEnd: new Date("2026-07-01"),
  allocatedConfig: null,
  metadata: null,
  pricing: {
    billingMode: "SUBSCRIPTION",
    type: "STANDARD",
    basePriceIdr: BigInt(299000),
    periodPrice: BigInt(299000),
    currency: "IDR",
    billingPeriod: "MONTHLY",
    region: { code: "GLOBAL" },
    servicePlan: { code: "WS", packageId: "pkg-1" },
  },
  plan: { code: "WHATSAPP_STANDARD" },
  package: { code: "WHATSAPP" },
}

function makeApp(
  overrides: Partial<Parameters<typeof createLifecycleRoutes>[0]> = {}
) {
  return new Elysia()
    .use(
      createLifecycleRoutes({
        authenticate: async () => defaultAuth,
        ...overrides,
      })
    )
    .compile()
}

describe("LifecycleRoute", () => {
  beforeEach(() => {
    for (const fn of [
      mockFindBillingAccount,
      mockFindFirst,
      mockUpdate,
      mockFindUnique,
      mockServicePricingFindUnique,
      mockBillingAccountFindUnique,
      mockAuditCreate,
    ]) {
      fn.mockReset()
    }
    mockFindBillingAccount.mockResolvedValue({ tenantId: TENANT_ID })
  })

  // ── Cancel ────────────────────────────────────────────────────────────────

  describe("POST /subscriptions/:id/cancel", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createLifecycleRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
          })
        )
        .compile()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      )

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when no billing account", async () => {
      mockFindBillingAccount.mockResolvedValueOnce({ tenantId: null })
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      )

      expect(res.status).toBe(403)
    })

    it("returns 404 when subscription not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null)
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 422 when subscription already cancelled", async () => {
      mockFindFirst.mockResolvedValue({
        ...baseSub,
        status: "CANCELLED",
      })
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("ALREADY_CANCELLED")
    })

    it("sets the cancellation flag and metadata and returns a transition", async () => {
      const updated = {
        ...baseSub,
        metadata: {
          cancelledAtPeriodEnd: true,
          cancelledReason: "Too expensive",
          cancelledAt: new Date().toISOString(),
        },
      }
      mockFindFirst.mockResolvedValueOnce(baseSub)
      mockUpdate.mockResolvedValueOnce(updated)

      const app = makeApp()
      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Too expensive" }),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.transition).toBe("CANCELLED_AT_PERIOD_END")
      expect(body.effectiveDate).toBe("2026-07-01T00:00:00.000Z")
      expect(body.subscription.cancelAtPeriodEnd).toBe(true)

      const updateCall = mockUpdate.mock.calls[0]?.[0] as {
        data?: {
          cancelAtPeriodEnd?: boolean
          metadata?: Record<string, unknown>
        }
      }
      expect(updateCall.data?.cancelAtPeriodEnd).toBe(true)
      const meta = updateCall.data?.metadata ?? {}

      expect(meta).toMatchObject({
        cancelledAtPeriodEnd: true,
        cancelledReason: "Too expensive",
      })
      expect(meta).toHaveProperty("cancelledAt")
    })

    it("returns 500 on database error", async () => {
      mockFindFirst.mockRejectedValueOnce(new Error("DB error"))
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      )

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })

  // ── Reinstate ─────────────────────────────────────────────────────────

  describe("POST /subscriptions/:id/reinstate", () => {
    const pendingCancelSub = {
      ...baseSub,
      metadata: { cancelledAtPeriodEnd: true, cancelledReason: "Monthly fee" },
    }

    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createLifecycleRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
          })
        )
        .compile()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/reinstate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      )

      expect(res.status).toBe(401)
    })

    it("returns 404 when subscription not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null)
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/reinstate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      )

      expect(res.status).toBe(404)
    })

    it("returns 404 when subscription has no pending cancellation", async () => {
      mockFindFirst
        .mockResolvedValueOnce({ ...baseSub, metadata: null })
        .mockResolvedValueOnce({ ...baseSub, metadata: null })
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/reinstate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      )

      expect(res.status).toBe(404)
    })

    it("clears cancelledAtPeriodEnd and returns REINSTATED", async () => {
      const reinstatedSub = { ...baseSub, metadata: {} }
      mockFindFirst
        .mockResolvedValueOnce(pendingCancelSub)
        .mockResolvedValueOnce(reinstatedSub)
      mockUpdate.mockResolvedValueOnce(reinstatedSub)

      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/reinstate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Changed my mind" }),
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.transition).toBe("REINSTATED")
      expect(body.subscription.cancelAtPeriodEnd).toBe(false)

      // Cancelled metadata fields removed
      const updateCall = mockUpdate.mock.calls[0]?.[0] as {
        data?: {
          cancelAtPeriodEnd?: boolean
          metadata?: Record<string, unknown>
        }
      }
      expect(updateCall.data?.cancelAtPeriodEnd).toBe(false)
      const meta = updateCall.data?.metadata ?? {}
      expect(meta).not.toHaveProperty("cancelledAtPeriodEnd")
      expect(meta).not.toHaveProperty("cancelledReason")
      expect(meta).not.toHaveProperty("cancelledAt")
    })
  })

  // ── Change Plan Preview ──────────────────────────────────────────────

  describe("GET /subscriptions/:id/change-plan/preview", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createLifecycleRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
          })
        )
        .compile()

      const res = await app.handle(
        new Request(
          `http://localhost/subscriptions/${SUB_ID}/change-plan/preview?pricingId=${PRICING_ID}`
        )
      )

      expect(res.status).toBe(401)
    })

    it("returns 422 for an empty pricingId", async () => {
      const app = makeApp()

      const res = await app.handle(
        new Request(
          `http://localhost/subscriptions/${SUB_ID}/change-plan/preview?pricingId=`
        )
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 404 when subscription not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null)
      const app = makeApp()

      const res = await app.handle(
        new Request(
          `http://localhost/subscriptions/${SUB_ID}/change-plan/preview?pricingId=${PRICING_ID}`
        )
      )

      expect(res.status).toBe(404)
    })
  })

  // ── Change Plan ─────────────────────────────────────────────────────

  describe("POST /subscriptions/:id/change-plan", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createLifecycleRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
          })
        )
        .compile()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/change-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pricingId: PRICING_ID }),
        })
      )

      expect(res.status).toBe(401)
    })

    it("returns 422 for an empty pricingId", async () => {
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/change-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pricingId: "" }),
        })
      )

      expect(res.status).toBe(422)
    })

    it("returns 404 when subscription not found", async () => {
      mockFindFirst.mockResolvedValueOnce(null)
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/change-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pricingId: PRICING_ID }),
        })
      )

      expect(res.status).toBe(404)
    })

    it("returns 422 when pricing not found", async () => {
      mockFindFirst.mockResolvedValue(baseSub)
      mockServicePricingFindUnique.mockResolvedValue(null)
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/change-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pricingId: PRICING_ID }),
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("PRICING_NOT_FOUND")
    })

    it("returns 422 when pricing is same as current", async () => {
      mockFindFirst.mockResolvedValueOnce(baseSub)
      mockServicePricingFindUnique.mockResolvedValueOnce({
        id: PRICING_ID,
        planId: baseSub.pricing.servicePlan.code,
        billingPeriod: "MONTHLY",
        servicePlan: { code: "WS", packageId: "pkg-1" },
        region: { code: "GLOBAL" },
      })
      const app = makeApp()

      const res = await app.handle(
        new Request(`http://localhost/subscriptions/${SUB_ID}/change-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pricingId: PRICING_ID }),
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("SAME_PLAN")
    })
  })
})
