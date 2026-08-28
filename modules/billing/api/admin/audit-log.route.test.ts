import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import type { MockAuthContext } from "@/test/helpers/test-auth"
import {
  defaultAuth,
  mockPlatformRole,
  mockPlatformRoleNone,
} from "@/test/helpers/test-auth"

const mockBillingAuditLogFindMany = mock()
const mockBillingAuditLogCount = mock()

const mockPrismaClient = {
  billingAuditLog: {
    findMany: mockBillingAuditLogFindMany,
    count: mockBillingAuditLogCount,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

const { createAdminAuditLogRoutes } = await import("./audit-log.route")

describe("AdminAuditLogRoute", () => {
  beforeEach(() => {
    mock.clearAllMocks()
  })

  describe("GET /admin/billing-audit/logs", () => {
    it("returns 401 when no auth user", async () => {
      const app = new Elysia()
        .use(
          createAdminAuditLogRoutes({
            authenticate: async () => ({ user: null }) as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/billing-audit/logs")
      )

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when user is not admin", async () => {
      const app = new Elysia()
        .use(
          createAdminAuditLogRoutes({
            authenticate: async () =>
              ({
                ...defaultAuth,
                role: "member",
              }) as MockAuthContext,
            getPlatformRole: mockPlatformRoleNone,
            isAdmin: () => false,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/billing-audit/logs")
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 403 when user is admin but not super_admin", async () => {
      const app = new Elysia()
        .use(
          createAdminAuditLogRoutes({
            authenticate: async () =>
              ({
                ...defaultAuth,
                role: "admin",
              }) as MockAuthContext,
            getPlatformRole: async () => "none" as const,
            isAdmin: () => true,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/billing-audit/logs")
      )

      expect(response.status).toBe(403)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("FORBIDDEN")
      expect(body.message).toBe(
        "Only super administrators can view audit logs."
      )
    })

    it("returns 422 on invalid query params", async () => {
      const app = new Elysia()
        .use(
          createAdminAuditLogRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/billing-audit/logs?page=0")
      )

      expect(response.status).toBe(422)
      const body = await response.json()
      expect(body).toBeDefined()
    })

    it("returns audit logs list with pagination successfully", async () => {
      const mockLogs = [
        {
          id: "log-1",
          billingAccountId: "ba-1",
          billingRunId: "run-1",
          entityType: "SUBSCRIPTION",
          entityId: "sub-1",
          action: "CREATED",
          actorType: "USER",
          actorId: "user-1",
          contextJson: { foo: "bar" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]

      mockBillingAuditLogFindMany.mockResolvedValueOnce(mockLogs)
      mockBillingAuditLogCount.mockResolvedValueOnce(1)

      const app = new Elysia()
        .use(
          createAdminAuditLogRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request(
          "http://localhost/admin/billing-audit/logs?page=1&limit=10&entityType=SUBSCRIPTION&entityId=sub-1&billingAccountId=ba-1"
        )
      )

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
      expect(body.logs).toHaveLength(1)
      expect(body.logs[0].id).toBe("log-1")
      expect(body.logs[0].createdAt).toBe("2026-01-01T00:00:00.000Z")
      expect(body.pagination.total).toBe(1)
      expect(body.pagination.totalPages).toBe(1)
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.limit).toBe(10)

      expect(mockBillingAuditLogFindMany).toHaveBeenCalledWith({
        where: {
          entityType: "SUBSCRIPTION",
          entityId: "sub-1",
          billingAccountId: "ba-1",
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      })
    })

    it("returns 500 when database query throws", async () => {
      mockBillingAuditLogFindMany.mockRejectedValueOnce(new Error("DB error"))
      mockBillingAuditLogCount.mockResolvedValueOnce(0)

      const app = new Elysia()
        .use(
          createAdminAuditLogRoutes({
            authenticate: async () => defaultAuth as MockAuthContext,
            getPlatformRole: mockPlatformRole,
          })
        )
        .compile()

      const response = await app.handle(
        new Request("http://localhost/admin/billing-audit/logs")
      )

      expect(response.status).toBe(500)
      const body = await response.json()
      expect(body.ok).toBe(false)
      expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    })
  })
})
