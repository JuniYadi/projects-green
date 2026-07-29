import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import { Elysia } from "elysia"

const mockFindMany = mock(() => Promise.resolve([]))
const mockFindUnique = mock(() => Promise.resolve(null))
const mockCount = mock(() => Promise.resolve(0))

mock.module("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      count: mockCount,
    },
  },
}))

mock.module("@/modules/admin/api/admin.guards", () => ({
  adminAuthGuard: () => (app: unknown) => app,
}))

import { emailLogRoutes } from "./email-logs.route"

const buildApp = () => new Elysia().use(emailLogRoutes)

describe("emailLogRoutes", () => {
  beforeEach(() => {
    mockFindMany.mockReset()
    mockFindUnique.mockReset()
    mockCount.mockReset()
    mockFindMany.mockImplementation(() => Promise.resolve([]))
    mockFindUnique.mockImplementation(() => Promise.resolve(null))
    mockCount.mockImplementation(() => Promise.resolve(0))
  })

  describe("GET /email-logs", () => {
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
      mockFindMany.mockImplementation(() => Promise.resolve(logs))
      mockCount.mockImplementation(() => Promise.resolve(1))

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

      expect(mockFindMany).toHaveBeenCalledWith(
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

      expect(mockFindMany).toHaveBeenCalledWith(
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

      expect(mockFindMany).toHaveBeenCalledWith(
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

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: "org-1" }),
        })
      )
    })

    it("paginates correctly", async () => {
      mockCount.mockImplementation(() => Promise.resolve(50))

      const app = buildApp()
      await app.handle(
        new Request("http://localhost/api/email-logs?page=3&limit=10")
      )

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 })
      )
    })
  })

  describe("GET /email-logs/:id", () => {
    it("returns email log detail with previewUrl", async () => {
      const now = new Date()
      mockFindUnique.mockImplementation(() =>
        Promise.resolve({
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
      )

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
      mockFindUnique.mockImplementation(() => Promise.resolve(null))

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
      mockFindUnique.mockImplementation(() =>
        Promise.resolve({ bodyHtml: "<p>Hello world</p>" })
      )

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs/log-1/preview")
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8")
    })

    it("returns 404 when bodyHtml is null", async () => {
      mockFindUnique.mockImplementation(() =>
        Promise.resolve({ bodyHtml: null })
      )

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs/log-1/preview")
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.ok).toBe(false)
    })

    it("returns 404 for unknown log", async () => {
      mockFindUnique.mockImplementation(() => Promise.resolve(null))

      const app = buildApp()
      const res = await app.handle(
        new Request("http://localhost/api/email-logs/unknown/preview")
      )
      const body = await res.json()

      expect(res.status).toBe(404)
    })
  })
})
