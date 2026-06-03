import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"
import { MockAuthContext } from "@/test/helpers/test-auth"
import { createBillingSubscriptionsRoutes } from "./subscriptions.route"

const mockFindBillingAccount = mock()
const mockFindMany = mock()

const mockPrismaClient = {
  billingAccount: {
    findUnique: mockFindBillingAccount,
  },
  subscription: {
    findMany: mockFindMany,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("SubscriptionsRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  describe("GET /subscriptions", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createBillingSubscriptionsRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/subscriptions", {
          method: "GET",
        })
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when no organization", async () => {
      const app = new Elysia()
        .use(
          createBillingSubscriptionsRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: null,
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/subscriptions", {
          method: "GET",
        })
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 200 with empty subscriptions array", async () => {
      mockFindBillingAccount.mockResolvedValueOnce({ tenantId: "tenant-1" })
      mockFindMany.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createBillingSubscriptionsRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/subscriptions", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.subscriptions).toEqual([])
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "tenant-1" },
        })
      )
    })

    it("returns 200 with formatted subscriptions", async () => {
      mockFindBillingAccount.mockResolvedValueOnce({ tenantId: "tenant-1" })
      mockFindMany.mockResolvedValueOnce([
        {
          id: "sub-1",
          status: "ACTIVE",
          allocatedConfig: { devices: 5 },
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
        },
      ])

      const app = new Elysia()
        .use(
          createBillingSubscriptionsRoutes({
            authenticate: async () => ({
              user: { id: "user-1" },
              organizationId: "org-1",
            } as MockAuthContext),
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/subscriptions", {
          method: "GET",
        })
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.subscriptions).toHaveLength(1)
      expect(body.subscriptions[0]).toMatchObject({
        id: "sub-1",
        status: "ACTIVE",
        packageCode: "WHATSAPP",
        planCode: "WHATSAPP_STANDARD",
        regionCode: "GLOBAL",
        billingMode: "SUBSCRIPTION",
        type: "STANDARD",
        monthlyRateIdr: "299000.00",
        quotaIn: 1000,
        quotaOut: 500,
        dailyPerDevice: 100,
      })
    })
  })
})