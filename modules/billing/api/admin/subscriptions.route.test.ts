import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

import { createAdminSubscriptionRoutes } from "./subscriptions.route"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"
import type { PlatformAccessRole } from "@/lib/platform-role"
import {
  type MockAuthContext,
  defaultAuth,
  mockPlatformRoleNone,
  mockPlatformRole,
  mockIsAdmin,
  testIsAdmin,
} from "@/test/helpers/test-auth"

const mockFindUnique = mock()
const mockUpdate = mock()
const mockFindMany = mock()
const mockCount = mock()

const mockPrismaClient = {
  serviceSubscription: {
    findUnique: mockFindUnique,
    update: mockUpdate,
    findMany: mockFindMany,
    count: mockCount,
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
    mockFindMany.mockReset()
    mockCount.mockReset()
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
            authenticate: async () => ({ user: null }) as MockAuthContext,
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
            getPlatformRole: mockPlatformRoleNone,
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
        plan: {
          code: "WHATSAPP_STANDARD",
          resources: {
            quotaIn: 1000,
            quotaOut: 500,
            dailyPerDevice: 100,
            devices: 5,
          },
        },
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
        plan: {
          code: "WHATSAPP_STANDARD",
          resources: {
            quotaIn: 1000,
            quotaOut: 500,
            dailyPerDevice: 100,
            devices: 5,
          },
        },
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
        plan: {
          code: "WHATSAPP_STANDARD",
          resources: {
            quotaIn: 1000,
            quotaOut: 500,
            dailyPerDevice: 100,
            devices: 5,
          },
        },
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

    it("returns 500 on database error", async () => {
      mockFindUnique.mockRejectedValueOnce(new Error("Database error"))

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

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })

    it("allows update when default isAdmin with super_admin", async () => {
      mockFindUnique
        .mockResolvedValueOnce({ id: "sub-1" })
        .mockResolvedValueOnce({
          id: "sub-1",
          planId: "plan-1",
          status: "SUSPENDED",
          allocatedConfig: null,
          currentPeriodEnd: new Date("2026-06-30"),
          plan: { code: "STANDARD", resources: {} },
          pricing: {
            billingMode: "SUBSCRIPTION",
            type: "STANDARD",
            basePriceIdr: new Decimal("100000"),
            region: { code: "GLOBAL" },
            servicePlan: { code: "S", packageId: "pkg-1" },
          },
          package: { code: "NON_WHATSAPP" },
        })
      mockUpdate.mockResolvedValueOnce({ id: "sub-1", status: "SUSPENDED" })

      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () =>
              ({
                user: { id: "admin-1" },
                organizationId: "org-1",
                role: "admin",
              }) as unknown as MockAuthContext,
            getPlatformRole: async () => "super_admin" as PlatformAccessRole,
            // No isAdmin override
          })
        )
        .compile()

      const res = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUSPENDED" }),
        })
      )

      expect(res.status).toBe(200)
    })

    it("allows update when default isAdmin with org role owner", async () => {
      mockFindUnique
        .mockResolvedValueOnce({ id: "sub-2" })
        .mockResolvedValueOnce({
          id: "sub-2",
          planId: "plan-1",
          status: "ACTIVE",
          allocatedConfig: null,
          currentPeriodEnd: new Date("2026-06-30"),
          plan: { code: "STANDARD", resources: {} },
          pricing: {
            billingMode: "SUBSCRIPTION",
            type: "STANDARD",
            basePriceIdr: new Decimal("100000"),
            region: { code: "GLOBAL" },
            servicePlan: { code: "S", packageId: "pkg-1" },
          },
          package: { code: "NON_WHATSAPP" },
        })
      mockUpdate.mockResolvedValueOnce({ id: "sub-2", status: "SUSPENDED" })

      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () =>
              ({
                user: { id: "owner-1" },
                organizationId: "org-1",
                role: "owner",
              }) as unknown as MockAuthContext,
            getPlatformRole: async () => "none" as PlatformAccessRole,
          })
        )
        .compile()

      const res = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-2", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUSPENDED" }),
        })
      )

      expect(res.status).toBe(200)
    })

    it("returns 403 when default isAdmin and user is member", async () => {
      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () =>
              ({
                user: { id: "member-1" },
                organizationId: "org-1",
                role: "member",
              }) as unknown as MockAuthContext,
            getPlatformRole: async () => "none" as PlatformAccessRole,
          })
        )
        .compile()

      const res = await app.handle(
        new Request("http://localhost/admin/subscriptions/sub-1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "SUSPENDED" }),
        })
      )

      expect(res.status).toBe(403)
    })
  })

  describe("GET /admin/subscriptions", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions")
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not admin", async () => {
      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions")
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns paginated subscriptions", async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          id: "sub-1",
          organizationId: "org-1",
          status: "ACTIVE",
          currentPeriodEnd: new Date("2026-06-30"),
          allocatedConfig: { devices: 5 },
          package: { code: "WHATSAPP" },
          plan: { code: "STANDARD" },
          pricing: {
            billingMode: "SUBSCRIPTION",
            type: "BUNDLE",
            basePriceIdr: new Decimal("299000"),
            region: { code: "GLOBAL" },
          },
        },
      ])
      mockCount.mockResolvedValueOnce(1)

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
        new Request("http://localhost/admin/subscriptions?page=1&limit=20")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.subscriptions).toHaveLength(1)
      expect(body.subscriptions[0].id).toBe("sub-1")
      expect(body.subscriptions[0].packageCode).toBe("WHATSAPP")
      expect(body.subscriptions[0].monthlyRateIdr).toBe("299000.00")
      expect(body.pagination.total).toBe(1)
    })

    it("filters by status", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockCount.mockResolvedValueOnce(0)

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
        new Request("http://localhost/admin/subscriptions?status=SUSPENDED")
      )

      expect(response.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "SUSPENDED" }),
        })
      )
    })

    it("filters by organizationId", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockCount.mockResolvedValueOnce(0)

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
        new Request(
          "http://localhost/admin/subscriptions?organizationId=org-123"
        )
      )

      expect(response.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-123",
          }),
        })
      )
    })

    it("scopes to caller org for non-super_admin", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockCount.mockResolvedValueOnce(0)

      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () =>
              ({
                user: { id: "admin-1" },
                organizationId: "org-1",
                role: "admin",
              }) as unknown as MockAuthContext,
            getPlatformRole: async () => "none" as PlatformAccessRole,
            isAdmin: () => true,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions")
      )

      expect(response.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: "org-1" }),
        })
      )
    })

    it("returns 500 on database error", async () => {
      mockFindMany.mockRejectedValueOnce(new Error("Database error"))

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
        new Request("http://localhost/admin/subscriptions")
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
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
        new Request("http://localhost/admin/subscriptions?status=INVALID")
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })
  })
})
