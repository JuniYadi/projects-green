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
})
