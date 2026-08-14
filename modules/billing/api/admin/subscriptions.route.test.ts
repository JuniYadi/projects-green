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
const mockFindFirst = mock()
const mockCreate = mock()
const mockCount = mock()
const mockWhatsappDeviceFindMany = mock()
const mockCreateOrder = mock()
const mockChargeOrder = mock()
const mockFulfillOrder = mock()

const mockPrismaClient = {
  serviceSubscription: {
    findUnique: mockFindUnique,
    findFirst: mockFindFirst,
    create: mockCreate,
    update: mockUpdate,
    findMany: mockFindMany,
    count: mockCount,
  },
  servicePackage: {
    findUnique: mockFindUnique,
  },
  servicePlan: {
    findUnique: mockFindUnique,
  },
  servicePricing: {
    findUnique: mockFindUnique,
  },
  pricing: {
    findUnique: mockFindUnique,
  },
  whatsappDevice: {
    findMany: mockWhatsappDeviceFindMany,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

mock.module("@/modules/billing/orders/order.service", () => ({
  BillingOrderService: class {
    createOrder = mockCreateOrder
    chargeOrder = mockChargeOrder
    fulfillOrder = mockFulfillOrder
  },
}))

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("AdminSubscriptionRoute", () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
    mockFindMany.mockReset()
    mockFindFirst.mockReset()
    mockCreate.mockReset()
    mockCount.mockReset()
    mockWhatsappDeviceFindMany.mockReset()
    mockCreateOrder.mockReset()
    mockChargeOrder.mockReset()
    mockFulfillOrder.mockReset()
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
    it("updates both plan and pricing when pricing belongs to plan", async () => {
      const planId = "11111111-1111-4111-8111-111111111111"
      const pricingId = "22222222-2222-4222-8222-222222222222"
      mockFindUnique
        .mockResolvedValueOnce({
          id: "sub-plan-pricing",
          organizationId: "org-1",
          status: "ACTIVE",
        })
        .mockResolvedValueOnce({ id: pricingId, planId })
        .mockResolvedValueOnce({
          id: "sub-plan-pricing",
          status: "ACTIVE",
          allocatedConfig: null,
          currentPeriodEnd: new Date("2026-06-30"),
          plan: { code: "STANDARD", resources: {} },
          pricing: {
            billingMode: "SUBSCRIPTION",
            type: "STANDARD",
            basePriceIdr: new Decimal("100000"),
            region: { code: "GLOBAL" },
          },
          package: { code: "VPN" },
        })
      mockUpdate.mockResolvedValueOnce({ id: "sub-plan-pricing" })

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
        new Request("http://localhost/admin/subscriptions/sub-plan-pricing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId, pricingId }),
        })
      )

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "sub-plan-pricing" },
        data: { planId, pricingId },
      })
      const body = await response.json()
      expect(body.subscription.planCode).toBe("STANDARD")
    })

    it("returns 404 when the current subscription disappears for an empty update", async () => {
      mockFindUnique
        .mockResolvedValueOnce({ id: "sub-vanished", organizationId: "org-1" })
        .mockResolvedValueOnce(null)

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
        new Request("http://localhost/admin/subscriptions/sub-vanished", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(response.status).toBe(404)
      expect((await response.json()).error).toBe("NOT_FOUND")
    })

    it("returns 404 when the updated subscription cannot be reloaded", async () => {
      mockFindUnique
        .mockResolvedValueOnce({ id: "sub-reload", organizationId: "org-1" })
        .mockResolvedValueOnce(null)
      mockUpdate.mockResolvedValueOnce({ id: "sub-reload" })

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
        new Request("http://localhost/admin/subscriptions/sub-reload", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        })
      )

      expect(response.status).toBe(404)
      expect((await response.json()).message).toBe(
        "Subscription not found after update."
      )
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

    it("returns only the explicit VPN relation for operational handoffs", async () => {
      const makeSubscription = (
        id: string,
        packageCode: string,
        vpnSubscription: { id: string } | null
      ) => ({
        id,
        organizationId: "org-1",
        pricingId: "pricing-1",
        billingPeriod: "MONTHLY",
        quantity: new Decimal("1"),
        priceLocked: new Decimal("100000"),
        currency: "IDR",
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        allocatedConfig: null,
        currentPeriodStart: new Date("2026-06-01"),
        currentPeriodEnd: new Date("2026-07-01"),
        package: { code: packageCode },
        plan: { code: "STANDARD" },
        pricing: {
          billingMode: "PACKAGE",
          type: "BUNDLE",
          basePriceIdr: new Decimal("100000"),
          periodPrice: new Decimal("100000"),
          currency: "IDR",
          region: { code: "GLOBAL" },
        },
        orders: [],
        vpnSubscription,
      })

      mockFindMany.mockResolvedValueOnce([
        makeSubscription("vpn-commercial", "VPN", { id: "vpn-ops-1" }),
        makeSubscription("vpn-legacy", "VPN", null),
        makeSubscription("app-subscription", "APP_HOSTING", null),
      ])
      mockCount.mockResolvedValueOnce(3)

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

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.subscriptions).toEqual([
        expect.objectContaining({
          id: "vpn-commercial",
          vpnSubscriptionId: "vpn-ops-1",
        }),
        expect.objectContaining({
          id: "vpn-legacy",
          vpnSubscriptionId: null,
        }),
        expect.objectContaining({
          id: "app-subscription",
          vpnSubscriptionId: null,
        }),
      ])
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            vpnSubscription: { select: { id: true } },
          }),
        })
      )
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
    it("returns 422 for invalid pagination", async () => {
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
        new Request("http://localhost/admin/subscriptions?page=0&limit=101")
      )

      expect(response.status).toBe(422)
      expect((await response.json()).message).toBe("Invalid query parameters.")
      expect(mockFindMany).not.toHaveBeenCalled()
    })

    it("formats billing period, locked price, quantity, and latest invoice", async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          id: "sub-quarterly",
          organizationId: "org-1",
          pricingId: "pricing-1",
          billingPeriod: "QUARTERLY",
          quantity: new Decimal("3"),
          priceLocked: new Decimal("750000"),
          currency: "USD",
          status: "ACTIVE",
          allocatedConfig: { devices: 3 },
          currentPeriodStart: new Date("2026-01-01"),
          currentPeriodEnd: new Date("2026-04-01"),
          package: { code: "VPN" },
          plan: { code: "PRO" },
          pricing: {
            billingMode: "SUBSCRIPTION",
            type: "BUNDLE",
            basePriceIdr: new Decimal("800000"),
            periodPrice: new Decimal("700000"),
            currency: "IDR",
            region: { code: "US" },
          },
          orders: [
            {
              id: "order-1",
              status: "CHARGED",
              billingInvoiceId: "invoice-1",
              billingInvoice: { status: "PAID" },
            },
          ],
        },
      ])
      mockCount.mockResolvedValueOnce(5)

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
        new Request("http://localhost/admin/subscriptions?page=2&limit=2")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.subscriptions[0]).toMatchObject({
        billingPeriod: "QUARTERLY",
        periodMonths: 3,
        periodPrice: "750000.00",
        currency: "USD",
        orderId: "order-1",
        quantity: "3.00",
        billingInvoiceId: "invoice-1",
        invoiceStatus: "PAID",
      })
      expect(body.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      })
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 2, take: 2 })
      )
    })
  })
  describe("POST /admin/subscriptions", () => {
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
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            packageId: "pkg-1",
            planId: "plan-1",
            pricingId: "price-1",
            type: "PAYG",
            billingMode: "PAYG",
            currentPeriodStart: "2026-01-01",
            currentPeriodEnd: "2026-02-01",
          }),
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not admin", async () => {
      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth,
            getPlatformRole: mockPlatformRoleNone,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            packageId: "pkg-1",
            planId: "plan-1",
            pricingId: "price-1",
            type: "PAYG",
            billingMode: "PAYG",
            currentPeriodStart: "2026-01-01",
            currentPeriodEnd: "2026-02-01",
          }),
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 422 when validation fails", async () => {
      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "",
            packageId: "",
            planId: "",
            pricingId: "",
            type: "INVALID",
            billingMode: "INVALID",
          }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("rejects removed client-supplied subscription fields", async () => {
      const app = new Elysia()
        .use(
          createAdminSubscriptionRoutes({
            authenticate: async () => defaultAuth,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            packageId: "pkg-1",
            planId: "plan-1",
            type: "BUNDLE",
            billingMode: "PACKAGE",
            billingPeriod: "MONTHLY",
            priceLocked: "100",
          }),
        })
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })
    it("returns 422 when pricing is not found", async () => {
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
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            pricingId: "pricing-missing",
          }),
        })
      )

      expect(response.status).toBe(422)
      expect((await response.json()).message).toBe("Pricing not found.")
      expect(mockFindFirst).not.toHaveBeenCalled()
    })

    it("returns 409 when an active package and plan already exists", async () => {
      mockFindUnique.mockResolvedValueOnce({
        planId: "plan-1",
        servicePlan: { packageId: "pkg-1", package: { code: "VPN" } },
        region: { code: "GLOBAL" },
      })
      mockFindFirst.mockResolvedValueOnce({ id: "existing-sub" })

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
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            pricingId: "pricing-1",
          }),
        })
      )

      expect(response.status).toBe(409)
      expect((await response.json()).error).toBe("CONFLICT")
      expect(mockCreateOrder).not.toHaveBeenCalled()
    })

    it("returns 422 when a WhatsApp subscription has no active devices", async () => {
      mockFindUnique.mockResolvedValueOnce({
        planId: "plan-whatsapp",
        servicePlan: {
          packageId: "pkg-whatsapp",
          package: { code: "WHATSAPP" },
          resources: { quotaOutMonthly: 5000 },
        },
        region: { code: "GLOBAL" },
      })
      mockFindFirst.mockResolvedValueOnce(null)
      mockWhatsappDeviceFindMany.mockResolvedValueOnce([])

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
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            pricingId: "pricing-wa",
          }),
        })
      )

      expect(response.status).toBe(422)
      expect((await response.json()).message).toBe(
        "At least one active WhatsApp device is required."
      )
      expect(mockCreateOrder).not.toHaveBeenCalled()
    })

    it("creates, charges, and fulfills a non-WhatsApp subscription", async () => {
      mockFindUnique
        .mockResolvedValueOnce({
          planId: "plan-vpn",
          servicePlan: {
            packageId: "pkg-vpn",
            package: { code: "VPN" },
            resources: {},
          },
          region: { code: "GLOBAL" },
        })
        .mockResolvedValueOnce({
          id: "sub-created",
          organizationId: "org-1",
          packageId: "pkg-vpn",
          planId: "plan-vpn",
          pricingId: "pricing-vpn",
          type: "STANDARD",
          billingMode: "SUBSCRIPTION",
          status: "ACTIVE",
          currentPeriodStart: new Date("2026-01-01"),
          currentPeriodEnd: new Date("2026-02-01"),
        })
      mockFindFirst.mockResolvedValueOnce(null)
      const created = {
        orderId: "order-created",
        status: "PENDING",
        subscriptionId: null,
        invoiceId: null,
        amount: "100000.00",
        currency: "IDR",
        billingPeriod: "MONTHLY",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      }
      const charged = { ...created, status: "CHARGED", invoiceId: "invoice-1" }
      const fulfilled = {
        ...charged,
        status: "FULFILLED",
        subscriptionId: "sub-created",
      }
      mockCreateOrder.mockResolvedValueOnce(created)
      mockChargeOrder.mockResolvedValueOnce(charged)
      mockFulfillOrder.mockResolvedValueOnce(fulfilled)

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
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            pricingId: "pricing-vpn",
            quantity: 2,
            allocatedConfig: { devices: 2 },
            metadata: { source: "admin" },
          }),
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.order).toEqual(fulfilled)
      expect(body.subscription).toMatchObject({
        id: "sub-created",
        organizationId: "org-1",
        status: "ACTIVE",
        currentPeriodEnd: "2026-02-01T00:00:00.000Z",
      })
      expect(mockCreateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          pricingId: "pricing-vpn",
          metadata: { source: "admin", allocatedConfig: { devices: 2 } },
        })
      )
      expect(mockChargeOrder).toHaveBeenCalledWith("order-created")
      expect(mockFulfillOrder).toHaveBeenCalledWith("order-created")
    })

    it("uses active WhatsApp devices as fulfillment quantity and metadata", async () => {
      mockFindUnique
        .mockResolvedValueOnce({
          planId: "plan-whatsapp",
          servicePlan: {
            packageId: "pkg-whatsapp",
            package: { code: "WHATSAPP" },
            resources: { quotaOutMonthly: 5000 },
          },
          region: { code: "GLOBAL" },
        })
        .mockResolvedValueOnce({
          id: "sub-whatsapp",
          organizationId: "org-1",
          packageId: "pkg-whatsapp",
          planId: "plan-whatsapp",
          pricingId: "pricing-wa",
          type: "BUNDLE",
          billingMode: "SUBSCRIPTION",
          status: "ACTIVE",
          currentPeriodStart: new Date("2026-01-01"),
          currentPeriodEnd: new Date("2026-02-01"),
        })
      mockFindFirst.mockResolvedValueOnce(null)
      mockWhatsappDeviceFindMany.mockResolvedValueOnce([
        { id: "device-1" },
        { id: "device-2" },
      ])
      const fulfilled = {
        orderId: "order-whatsapp",
        status: "FULFILLED",
        subscriptionId: "sub-whatsapp",
        invoiceId: "invoice-wa",
        amount: "200000.00",
        currency: "IDR",
        billingPeriod: "MONTHLY",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-02-01T00:00:00.000Z",
      }
      mockCreateOrder.mockResolvedValueOnce({ ...fulfilled, status: "PENDING" })
      mockChargeOrder.mockResolvedValueOnce({ ...fulfilled, status: "CHARGED" })
      mockFulfillOrder.mockResolvedValueOnce(fulfilled)

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
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            pricingId: "pricing-wa",
            quantity: 99,
          }),
        })
      )

      expect(response.status).toBe(200)
      const orderInput = mockCreateOrder.mock.calls[0]?.[0]
      expect(orderInput.quantity.toString()).toBe("2")
      expect(orderInput.metadata).toMatchObject({
        deviceIds: ["device-1", "device-2"],
        allowanceByDevice: { "device-1": 5000, "device-2": 5000 },
      })
    })

    it("maps pricing errors from order creation to validation", async () => {
      mockFindUnique.mockResolvedValueOnce({
        planId: "plan-vpn",
        servicePlan: {
          packageId: "pkg-vpn",
          package: { code: "VPN" },
          resources: {},
        },
        region: { code: "GLOBAL" },
      })
      mockFindFirst.mockResolvedValueOnce(null)
      mockCreateOrder.mockRejectedValueOnce(new Error("PRICING_INACTIVE"))

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
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            pricingId: "pricing-vpn",
          }),
        })
      )

      expect(response.status).toBe(422)
      expect((await response.json()).error).toBe("VALIDATION_ERROR")
    })

    it("returns 500 for an unexpected order error", async () => {
      mockFindUnique.mockResolvedValueOnce({
        planId: "plan-vpn",
        servicePlan: {
          packageId: "pkg-vpn",
          package: { code: "VPN" },
          resources: {},
        },
        region: { code: "GLOBAL" },
      })
      mockFindFirst.mockResolvedValueOnce(null)
      mockCreateOrder.mockRejectedValueOnce(new Error("database unavailable"))

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
        new Request("http://localhost/admin/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: "org-1",
            pricingId: "pricing-vpn",
          }),
        })
      )

      expect(response.status).toBe(500)
      expect((await response.json()).error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
