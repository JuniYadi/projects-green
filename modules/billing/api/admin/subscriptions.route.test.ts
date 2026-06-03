import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

import { createAdminSubscriptionRoutes } from "./subscriptions.route"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"
import {
  type MockAuthContext,
  defaultAuth,
  mockPlatformRole,
  mockIsAdmin,
  testIsAdmin,
} from "@/test/helpers/test-auth"
import type { PlatformAccessRole } from "@/lib/platform-role"

const mockFindUnique = mock()
const mockUpdate = mock()

const mockPrismaClient = {
  subscription: {
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
  pricing: {
    findUnique: mockFindUnique,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("AdminSubscriptionRoute", () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
  })

  testIsAdmin((actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  })

  describe("PATCH /admin/subscriptions/:id", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUSPENDED" }),
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 422 for invalid status", async () => {
      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "INVALID_STATUS" }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 403 when not admin", async () => {
      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: async () => "none" as PlatformAccessRole,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUSPENDED" }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 404 when subscription not found", async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions/non-existent", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUSPENDED" }),
        })
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 422 when pricing doesn't belong to plan", async () => {
      // First call: find subscription
      mockFindUnique.mockResolvedValueOnce({
        id: "sub-1",
        planId: "plan-a",
      })
      // Second call: find pricing (returns different plan)
      mockFindUnique.mockResolvedValueOnce({
        id: "pricing-1",
        planId: "plan-b", // Different from subscription's planId
      })

      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: "plan-a",
            pricingId: "pricing-1",
          }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 200 when no updates provided (returns current subscription)", async () => {
      const currentSubscription = {
        id: "sub-1",
        planId: "plan-1",
        status: "ACTIVE",
        allocatedConfig: null,
        currentPeriodEnd: new Date("2026-06-30"),
        plan: { code: "WHATSAPP_STANDARD", resources: { quotaIn: 1000, quotaOut: 500, dailyPerDevice: 100, devices: 5 } },
        pricing: {
          billingMode: "SUBSCRIPTION",
          type: "STANDARD",
          basePriceIdr: new Decimal("299000"),
          region: { code: "GLOBAL" },
          servicePlan: { code: "WS", packageId: "pkg-1" },
        },
        package: { code: "WHATSAPP" },
      }

      // First call at line 140 to check exists, second at line 186 for no-updates branch
      mockFindUnique
        .mockResolvedValueOnce(currentSubscription)
        .mockResolvedValueOnce(currentSubscription)

      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}), // Empty body - no updates
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.subscription.id).toBe("sub-1")
    })

    it("returns 200 with updated subscription on valid status update", async () => {
      const updatedSubscription = {
        id: "sub-1",
        planId: "plan-1",
        status: "SUSPENDED",
        allocatedConfig: null,
        currentPeriodEnd: new Date("2026-06-30"),
        plan: { code: "WHATSAPP_STANDARD", resources: { quotaIn: 1000, quotaOut: 500, dailyPerDevice: 100, devices: 5 } },
        pricing: {
          billingMode: "SUBSCRIPTION",
          type: "STANDARD",
          basePriceIdr: new Decimal("299000"),
          region: { code: "GLOBAL" },
          servicePlan: { code: "WS", packageId: "pkg-1" },
        },
        package: { code: "WHATSAPP" },
      }

      mockFindUnique
        .mockResolvedValueOnce({ id: "sub-1" }) // line 140 - check exists
        .mockResolvedValueOnce(updatedSubscription) // line 228 - after update
      mockUpdate.mockResolvedValueOnce({
        id: "sub-1",
        status: "SUSPENDED",
      })

      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUSPENDED" }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.subscription.status).toBe("SUSPENDED")
    })

    it("returns 200 with updated allocatedConfig", async () => {
      const updatedSubscription = {
        id: "sub-1",
        planId: "plan-1",
        status: "ACTIVE",
        allocatedConfig: { devices: 10 },
        currentPeriodEnd: new Date("2026-06-30"),
        plan: { code: "WHATSAPP_STANDARD", resources: { quotaIn: 1000, quotaOut: 500, dailyPerDevice: 100, devices: 5 } },
        pricing: {
          billingMode: "SUBSCRIPTION",
          type: "STANDARD",
          basePriceIdr: new Decimal("299000"),
          region: { code: "GLOBAL" },
          servicePlan: { code: "WS", packageId: "pkg-1" },
        },
        package: { code: "WHATSAPP" },
      }

      mockFindUnique
        .mockResolvedValueOnce({ id: "sub-1" }) // line 140 - check exists
        .mockResolvedValueOnce(updatedSubscription) // line 228 - after update
      mockUpdate.mockResolvedValueOnce({
        id: "sub-1",
        status: "ACTIVE",
        allocatedConfig: { devices: 10 },
      })

      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allocatedConfig: { devices: 10 } }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.subscription.allocatedConfig).toEqual({ devices: 10 })
    })
  })
})