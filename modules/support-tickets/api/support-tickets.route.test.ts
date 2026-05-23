import { describe, expect, it } from "bun:test"
import { Elysia } from "elysia"

import { createSupportTicketRoutes } from "@/modules/support-tickets/api/support-tickets.route"
import {
  SupportTicketAccessDeniedError,
  SupportTicketNotFoundError,
  type SupportTicketService,
} from "@/modules/support-tickets/support-ticket.service"
import type { SupportTicket } from "@/modules/support-tickets/support-ticket.types"

const baseTicket: SupportTicket = {
  id: "ticket_1",
  ticketNumber: "TCK-1001",
  organizationId: "org_1",
  requesterWorkosUserId: "user_1",
  assignedAgentWorkosUserId: null,
  department: "technical",
  priority: "medium",
  service: "deploy",
  status: "open",
  subject: "Deployment issue",
  description: "Pipeline failed",
  secureForm: null,
  attachmentMetadata: [],
  createdAt: new Date("2026-05-21T00:00:00.000Z"),
  updatedAt: new Date("2026-05-21T00:00:00.000Z"),
  resolvedAt: null,
  closedAt: null,
}

const createApp = (service: Partial<SupportTicketService>) => {
  return new Elysia().use(
    createSupportTicketRoutes({
      authenticate: async () => ({
        organizationId: "org_1",
        role: "member",
        roles: ["member"],
        user: {
          id: "user_1",
          email: "user@example.com",
        },
      }),
      getPlatformRole: async () => "none",
      service: {
        async listTickets() {
          return [baseTicket]
        },
        async createTicket() {
          return baseTicket
        },
        async getTicketThread() {
          return {
            ticket: baseTicket,
            replies: [],
          }
        },
        async addReply() {
          return {
            id: "reply_1",
            ticketId: "ticket_1",
            authorWorkosUserId: "user_1",
            body: "Acknowledged",
            secureForm: null,
            isInternalNote: false,
            attachmentMetadata: [],
            createdAt: new Date("2026-05-21T01:00:00.000Z"),
            updatedAt: new Date("2026-05-21T01:00:00.000Z"),
          }
        },
        async transitionStatus() {
          return {
            ...baseTicket,
            status: "closed",
            closedAt: new Date("2026-05-22T00:00:00.000Z"),
          }
        },
        ...service,
      } as SupportTicketService,
      emailService: {
        async sendTicketCreated() {},
        async sendTicketReplied() {},
        async sendTicketClosed() {},
      },
    })
  )
}

describe("support ticket routes", () => {
  it("lists tickets", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      tickets: [{ id: "ticket_1" }],
    })
  })

  it("creates ticket", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject: "Deployment issue",
          department: "technical",
          priority: "high",
          service: "deploy",
          secureForm: "secret",
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      ok: true,
      ticket: { id: "ticket_1" },
    })
  })

  it("returns validation envelope for invalid create payload", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject: "",
          department: "technical",
          priority: "medium",
        }),
      })
    )
    expect(response.status).toBe(422)
    const payload = (await response.json()) as Record<string, unknown>
    expect(payload).toBeDefined()
  })

  it("returns thread by ticket id", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      thread: { ticket: { id: "ticket_1" } },
    })
  })

  it("creates reply", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1/replies", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          body: "Acknowledged",
          secureForm: "sensitive",
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      ok: true,
      reply: { id: "reply_1" },
    })
  })

  it("closes ticket", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1/close", {
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      ticket: { status: "closed" },
    })
  })

  it("maps service not found errors", async () => {
    const app = createApp({
      async getTicketThread() {
        throw new SupportTicketNotFoundError("ticket_missing")
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_missing", {
        method: "GET",
      })
    )

    expect(response.status).toBe(404)
  })

  it("maps forbidden errors", async () => {
    const app = createApp({
      async transitionStatus() {
        throw new SupportTicketAccessDeniedError("update status of")
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1/close", {
        method: "POST",
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    })
  })

  const createAdminApp = (service: Partial<SupportTicketService>, platformRole: "none" | "super_admin") => {
    return new Elysia().use(
      createSupportTicketRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          role: "member",
          roles: ["member"],
          user: {
            id: "user_admin",
            email: "admin@example.com",
          },
        }),
        getPlatformRole: async () => platformRole,
        service: {
          async listTickets() { return [] },
          async createTicket() { return baseTicket },
          async getTicketThread() { return { ticket: baseTicket, replies: [] } },
          async addReply() { return { id: "reply_1", ticketId: "ticket_1", authorWorkosUserId: "user_1", body: "Ok", secureForm: null, isInternalNote: false, attachmentMetadata: [], createdAt: new Date(), updatedAt: new Date() } },
          async transitionStatus() { return baseTicket },
          async listAllTickets() { return [baseTicket] },
          async updateTicket() { return baseTicket },
          async deleteTicket() { return true },
          ...service,
        } as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
        },
      })
    )
  }

  it("blocks non-admins from admin routes", async () => {
    const app = createAdminApp({}, "none")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin", {
        method: "GET",
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    })
  })

  it("lists all tickets for super admin", async () => {
    const app = createAdminApp({}, "super_admin")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      tickets: [{ id: "ticket_1" }],
    })
  })

  it("creates ticket for custom organization as admin", async () => {
    let createdWithOrg = ""
    const app = createAdminApp({
      async createTicket(input) {
        createdWithOrg = input.organizationId
        return {
          ...baseTicket,
          organizationId: input.organizationId,
        }
      }
    }, "super_admin")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          organizationId: "org_custom",
          subject: "Admin created",
          department: "technical",
          priority: "high",
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(createdWithOrg).toBe("org_custom")
  })

  it("updates ticket details as admin", async () => {
    let updatedFields = {}
    const app = createAdminApp({
      async updateTicket(input) {
        updatedFields = input.data
        return {
          ...baseTicket,
          ...input.data,
        } as unknown as SupportTicket
      }
    }, "super_admin")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin/ticket_1", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          department: "billing",
          priority: "low",
          status: "in_progress",
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(updatedFields).toMatchObject({
      department: "billing",
      priority: "low",
      status: "in_progress",
    })
  })

  it("deletes ticket as admin", async () => {
    let deletedId = ""
    const app = createAdminApp({
      async deleteTicket(input) {
        deletedId = input.ticketId
        return true
      }
    }, "super_admin")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin/ticket_1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(200)
    expect(deletedId).toBe("ticket_1")
  })

  it("blocks non-admins from admin/organizations route", async () => {
    const app = createAdminApp({}, "none")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin/organizations", {
        method: "GET",
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    })
  })

  it("blocks non-admins from admin create route", async () => {
    const app = createAdminApp({}, "none")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          organizationId: "org_custom",
          subject: "Admin created",
          department: "technical",
          priority: "high",
        }),
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    })
  })

  it("blocks non-admins from admin update route", async () => {
    const app = createAdminApp({}, "none")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin/ticket_1", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          priority: "low",
        }),
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    })
  })

  it("blocks non-admins from admin delete route", async () => {
    const app = createAdminApp({}, "none")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin/ticket_1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    })
  })

  it("blocks members from admin routes even with owner role", async () => {
    const app = new Elysia().use(
      createSupportTicketRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          role: "user_owner",
          roles: ["user_owner"],
          user: {
            id: "user_owner",
            email: "owner@example.com",
          },
        }),
        getPlatformRole: async () => "none",
        service: {
          async listTickets() { return [baseTicket] },
          async createTicket() { return baseTicket },
          async getTicketThread() { return { ticket: baseTicket, replies: [] } },
          async addReply() { return { id: "reply_1", ticketId: "ticket_1", authorWorkosUserId: "user_1", body: "Ok", secureForm: null, isInternalNote: false, attachmentMetadata: [], createdAt: new Date(), updatedAt: new Date() } },
          async transitionStatus() { return baseTicket },
          async listAllTickets() { return [baseTicket] },
          async updateTicket() { return baseTicket },
          async deleteTicket() { return true },
        } as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin", {
        method: "GET",
      })
    )

    expect(response.status).toBe(403)
  })
})
