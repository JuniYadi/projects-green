import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { TestDecimal as Decimal } from "@/test/helpers/prisma-mock"

import { createAdminUsageRoutes } from "./usage.route"
import type { PlatformAccessRole } from "@/lib/platform-role"
import {
  type MockAuthContext,
  defaultAuth,
  mockPlatformRoleNone,
  mockPlatformRole,
  mockIsAdmin,
  testIsAdmin,
} from "@/test/helpers/test-auth"

const mockFindMany = mock()
const mockGroupBy = mock()

const mockPrismaClient = {
  billingUsageLedger: {
    findMany: mockFindMany,
    groupBy: mockGroupBy,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

describe("AdminUsageRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  testIsAdmin((actor) => {
    if (actor.platformRole === "super_admin") return true
    return actor.orgRole === "admin" || actor.orgRole === "owner"
  })

  describe("GET /admin/usage", () => {
    it("returns 401 when no auth", async () => {
      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () => ({ user: null } as MockAuthContext),
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage")
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when not admin", async () => {
      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage")
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns usage breakdown and trend", async () => {
      mockFindMany.mockResolvedValueOnce([
        {
          category: "whatsapp",
          amountIdr: new Decimal("5000"),
          createdAt: new Date("2026-06-01T10:00:00Z"),
        },
        {
          category: "whatsapp",
          amountIdr: new Decimal("3000"),
          createdAt: new Date("2026-06-02T10:00:00Z"),
        },
      ])
      mockGroupBy.mockResolvedValueOnce([
        {
          category: "whatsapp",
          _sum: { amountIdr: new Decimal("8000") },
          _count: 2,
        },
      ])

      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage?days=30")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data.breakdown).toHaveLength(1)
      expect(body.data.breakdown[0].category).toBe("whatsapp")
      expect(body.data.breakdown[0].quantity).toBe(2)
      expect(body.data.breakdown[0].percentage).toBe(100)
      expect(body.data.trend).toHaveLength(2)
    })

    it("handles null category as unknown", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockGroupBy.mockResolvedValueOnce([
        {
          category: null,
          _sum: { amountIdr: new Decimal("1000") },
          _count: 1,
        },
      ])

      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data.breakdown[0].category).toBe("unknown")
    })

    it("returns empty breakdown and trend when no data", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockGroupBy.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage")
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.data.breakdown).toHaveLength(0)
      expect(body.data.trend).toHaveLength(0)
    })

    it("scopes to caller org for non-super_admin", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockGroupBy.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () =>
              ({
                user: { id: "admin-1" },
                organizationId: "org-1",
                role: "admin",
              } as unknown as MockAuthContext),
            getPlatformRole: async () => "none" as PlatformAccessRole,
            isAdmin: () => true,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage")
      )

      expect(response.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: "org-1" }),
        })
      )
    })

    it("returns 422 for invalid days parameter", async () => {
      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage?days=0")
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("VALIDATION_ERROR")
    })

    it("returns 500 on database error", async () => {
      mockFindMany.mockRejectedValueOnce(new Error("Database error"))

      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
            isAdmin: mockIsAdmin,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage")
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })

    it("allows access when default isAdmin with super_admin", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockGroupBy.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () =>
              ({
                user: { id: "admin-1" },
                organizationId: "org-1",
                role: "admin",
              } as unknown as MockAuthContext),
            getPlatformRole: async () => "super_admin" as PlatformAccessRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage")
      )

      expect(response.status).toBe(200)
    })

    it("returns 403 when default isAdmin and user is member", async () => {
      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () =>
              ({
                user: { id: "member-1" },
                organizationId: "org-1",
                role: "member",
              } as unknown as MockAuthContext),
            getPlatformRole: async () => "none" as PlatformAccessRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/usage")
      )

      expect(response.status).toBe(403)
    })

    it("scopes to provided orgId for super_admin", async () => {
      mockFindMany.mockResolvedValueOnce([])
      mockGroupBy.mockResolvedValueOnce([])

      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () =>
              ({
                user: { id: "admin-1" },
                organizationId: "org-1",
                role: "admin",
              } as unknown as MockAuthContext),
            getPlatformRole: async () =>
              "super_admin" as PlatformAccessRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(
          "http://localhost/admin/usage?orgId=550e8400-e29b-41d4-a716-446655440000"
        )
      )

      expect(response.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "550e8400-e29b-41d4-a716-446655440000",
          }),
        })
      )
    })

    it("returns 403 when non-super_admin provides orgId", async () => {
      const app = new Elysia()
        .use(
          createAdminUsageRoutes({
            authenticate: async () =>
              ({
                user: { id: "admin-1" },
                organizationId: "org-1",
                role: "admin",
              } as unknown as MockAuthContext),
            getPlatformRole: async () => "none" as PlatformAccessRole,
            isAdmin: () => true,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(
          "http://localhost/admin/usage?orgId=550e8400-e29b-41d4-a716-446655440000"
        )
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.error).toBe("FORBIDDEN")
    })
  })
})
