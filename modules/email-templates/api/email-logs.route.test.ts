import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  AdminApiError,
  AdminActorContext,
  RouteSet,
} from "@/modules/admin/api/admin.guards"
import { Elysia } from "elysia"
import { createMockPrisma } from "@/test/helpers/prisma-mock"

const { prisma: mockPrisma, mock: mockMethods } = createMockPrisma({
  emailLog: ["findMany", "findUnique", "count"],
})

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))
const allowedGuard = mock<
  (set: RouteSet) => Promise<AdminActorContext | AdminApiError>
>(async () => ({
  ok: true as const,
  userId: "admin_1",
  platformRole: "super_admin" as const,
}))

import { createEmailLogRoutes } from "./email-logs.route"

const buildApp = () =>
  new Elysia({ prefix: "/api" }).use(
    createEmailLogRoutes({ requireSuperAdmin: allowedGuard })
  )

describe("emailLogRoutes", () => {
  beforeEach(() => {
    mockMethods.emailLog.findMany.mockClear()
    mockMethods.emailLog.findUnique.mockClear()
    mockMethods.emailLog.count.mockClear()
    allowedGuard.mockClear()
    mockMethods.emailLog.findMany.mockResolvedValue([])
    mockMethods.emailLog.findUnique.mockResolvedValue(null)
    mockMethods.emailLog.count.mockResolvedValue(0)
    allowedGuard.mockImplementation(async () => ({
      ok: true as const,
      userId: "admin_1",
      platformRole: "super_admin" as const,
    }))
  })

  describe("GET /email-logs", () => {
    it("rejects unauthorized access before querying Prisma", async () => {
      allowedGuard.mockImplementation(async (set) => {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "This action requires super admin access.",
        }
      })

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs")
      )
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body).toEqual({
        ok: false,
        error: "FORBIDDEN",
        message: "This action requires super admin access.",
      })
      expect(mockMethods.emailLog.findMany).not.toHaveBeenCalled()
      expect(mockMethods.emailLog.count).not.toHaveBeenCalled()
    })

    it("returns paginated list of email logs", async () => {
      const now = new Date()
      const logs = [
        {
          id: "log-1",
          recipientEmail: "user@example.com",
          type: "TICKET_CREATED",
          subject: "Your ticket was created",
          status: "SENT",
          organizationId: "org-1",
          relatedEntityType: "support_ticket",
          relatedEntityId: "ticket-1",
          ticketId: "ticket-1",
          ticketNumber: "TKT-001",
          providerMessageId: "msg-1",
          errorMessage: null,
          attempts: 1,
          sentAt: now,
          createdAt: now,
          updatedAt: now,
          bodyHtml: "<p>Hello</p>",
        },
      ]
      mockMethods.emailLog.findMany.mockResolvedValue(logs)
      mockMethods.emailLog.count.mockResolvedValue(1)

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs?page=1&limit=20")
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].id).toBe("log-1")
      expect(body.data[0].hasPreview).toBe(true)
      expect(body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      })
    })

    it("filters by status", async () => {
      const app = buildApp()
      await app.handle(
        new Request("http://localhost/api/email-logs?status=FAILED")
      )

      expect(mockMethods.emailLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "FAILED" }),
        })
      )
    })

    it("filters by type", async () => {
      const app = buildApp()
      await app.handle(
        new Request("http://localhost/api/email-logs?type=TICKET_CREATED")
      )

      expect(mockMethods.emailLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: "TICKET_CREATED" }),
        })
      )
    })

    it("filters by recipient search", async () => {
      const app = buildApp()
      await app.handle(
        new Request("http://localhost/api/email-logs?recipient=example.com")
      )

      expect(mockMethods.emailLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recipientEmail: { contains: "example.com" },
          }),
        })
      )
    })

    it("filters by organizationId", async () => {
      const app = buildApp()
      await app.handle(
        new Request("http://localhost/api/email-logs?organizationId=org-1")
      )

      expect(mockMethods.emailLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: "org-1" }),
        })
      )
    })

    it("paginates correctly", async () => {
      mockMethods.emailLog.count.mockResolvedValue(50)

      const app = buildApp()
      await app.handle(
        new Request("http://localhost/api/email-logs?page=3&limit=10")
      )

      expect(mockMethods.emailLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 })
      )
    })
  })

  describe("GET /email-logs/:id", () => {
    it("returns email log detail with previewUrl", async () => {
      const now = new Date()
      mockMethods.emailLog.findUnique.mockResolvedValue({
        id: "log-1",
        recipientEmail: "user@example.com",
        type: "TICKET_CREATED",
        subject: "Your ticket was created",
        status: "SENT",
        organizationId: "org-1",
        relatedEntityType: "support_ticket",
        relatedEntityId: "ticket-1",
        ticketId: "ticket-1",
        ticketNumber: "TKT-001",
        providerMessageId: "msg-1",
        errorMessage: null,
        attempts: 1,
        sentAt: now,
        createdAt: now,
        updatedAt: now,
        bodyHtml: "<p>Hello</p>",
      })

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs/log-1")
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data.id).toBe("log-1")
      expect(body.data.previewUrl).toBe("/api/email-logs/log-1/preview")
    })

    it("returns 404 for unknown log", async () => {
      mockMethods.emailLog.findUnique.mockResolvedValue(null)

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs/unknown-id")
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
      expect(body.error).toBe("NOT_FOUND")
    })
  })

  describe("GET /email-logs/:id/preview", () => {
    it("returns redacted HTML", async () => {
      mockMethods.emailLog.findUnique.mockResolvedValue({
        bodyHtml: "<p>Hello world</p>",
      } as Record<string, unknown>)

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs/log-1/preview")
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8")
      expect(await res.text()).toBe("<p>Hello world</p>")
    })

    it("returns 404 when bodyHtml is null", async () => {
      mockMethods.emailLog.findUnique.mockResolvedValue({
        bodyHtml: null,
      } as Record<string, unknown>)

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs/log-1/preview")
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
    })

    it("returns 404 for unknown log", async () => {
      mockMethods.emailLog.findUnique.mockResolvedValue(null)

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs/unknown/preview")
      )

      expect(res.status).toBe(404)
    })
  })
})
