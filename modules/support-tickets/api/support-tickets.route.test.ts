import { describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockGetUser = mock(async (id: string) => ({
  id,
  email: "staff@example.com",
  firstName: "Staff",
  lastName: "User",
  profilePictureUrl: null,
}))

const mockListOrganizationMemberships = mock(async () => ({
  data: [
    {
      role: { slug: "admin_owner" },
      roles: [{ slug: "admin_owner" }],
    },
  ],
}))

const mockListOrganizations = mock(async () => ({
  data: [
    { id: "org_1", name: "Org 1" },
    { id: "org_2", name: "Org 2" },
  ],
}))

mock.module("@workos-inc/authkit-nextjs", () => {
  return {
    withAuth: async () => ({
      organizationId: "org_1",
      role: "member",
      roles: ["member"],
      user: {
        id: "user_1",
        email: "user@example.com",
      },
    }),
    getWorkOS: () => ({
      userManagement: {
        getUser: mockGetUser,
        listOrganizationMemberships: mockListOrganizationMemberships,
      },
      organizations: {
        getOrganization: async () => ({ id: "org_1", name: "Org 1" }),
        listOrganizations: mockListOrganizations,
      },
    }),
  }
})


import { createSupportTicketRoutes } from "@/modules/support-tickets/api/support-tickets.route"
import {
  SupportTicketAccessDeniedError,
  SupportTicketNotFoundError,
  type SupportTicketService,
} from "@/modules/support-tickets/support-ticket.service"
import type { SupportTicket } from "@/modules/support-tickets/support-ticket.types"

type SupportTicketThreadResponse = {
  ok: true
  thread: {
    ticket: SupportTicket
    replies: Array<{ id: string; authorWorkosUserId: string; isInternalNote: boolean; organizationName?: string | null }>
    users?: Record<string, { isStaff: boolean }>
  }
}

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

  it("converts markdown to unescaped HTML on preview", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets/preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          markdown: "# Udah masuk\n\n- ok 1",
        }),
      })
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as { ok: true; html: string }
    expect(json.ok).toBe(true)
    expect(json.html).toContain("<h1>Udah masuk</h1>")
    expect(json.html).toContain("<li>ok 1</li>")
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

  it("marks a user as staff if they have platform super_admin role or scoped admin_owner claim in WorkOS organization memberships", async () => {
    const app = createApp({
      async getTicketThread() {
        return {
          ticket: baseTicket,
          replies: [
            {
              id: "reply_1",
              ticketId: "ticket_1",
              authorWorkosUserId: "user_admin",
              body: "I am staff",
              secureForm: null,
              isInternalNote: false,
              attachmentMetadata: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as SupportTicketThreadResponse
    expect(json.ok).toBe(true)
    expect(json.thread.users?.user_admin?.isStaff).toBe(true)
  })

  it("handles organization lookup error gracefully with null organizationName", async () => {
    const mockGetOrganization = mock(async () => {
      throw new Error("Organization service unavailable")
    })

    mock.module("@workos-inc/authkit-nextjs", () => {
      return {
        withAuth: async () => ({
          organizationId: "org_1",
          role: "member",
          roles: ["member"],
          user: {
            id: "user_1",
            email: "user@example.com",
          },
        }),
        getWorkOS: () => ({
          userManagement: {
            getUser: mockGetUser,
            listOrganizationMemberships: mockListOrganizationMemberships,
          },
          organizations: {
            getOrganization: mockGetOrganization,
            listOrganizations: async () => ({ data: [] }),
          },
        }),
      }
    })

    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as SupportTicketThreadResponse
    expect(json.ok).toBe(true)
    expect(json.thread.ticket.organizationName).toBeNull()
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

  it("returns thread with all replies for admin users", async () => {
    const internalNoteReply = {
      id: "reply_internal",
      ticketId: "ticket_1",
      authorWorkosUserId: "user_admin",
      body: "This is an internal note",
      secureForm: null,
      isInternalNote: true,
      attachmentMetadata: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const publicReply = {
      id: "reply_public",
      ticketId: "ticket_1",
      authorWorkosUserId: "user_1",
      body: "This is a public reply",
      secureForm: null,
      isInternalNote: false,
      attachmentMetadata: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const app = createAdminApp({
      async getTicketThread() {
        return {
          ticket: baseTicket,
          replies: [internalNoteReply, publicReply],
        }
      },
    }, "super_admin")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as SupportTicketThreadResponse
    expect(json.ok).toBe(true)
    expect(json.thread.replies).toHaveLength(2)
  })

  it("returns only public replies for regular users", async () => {
    const publicReply = {
      id: "reply_public",
      ticketId: "ticket_1",
      authorWorkosUserId: "user_1",
      body: "This is a public reply",
      secureForm: null,
      isInternalNote: false,
      attachmentMetadata: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // The service layer filters internal notes for non-super-admin actors.
    // This route-level test verifies the end-to-end plumbing: the route
    // correctly passes through the filtered response from the service.
    const app = createApp({
      async getTicketThread() {
        return {
          ticket: baseTicket,
          replies: [publicReply],
        }
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as SupportTicketThreadResponse
    expect(json.ok).toBe(true)
    expect(json.thread.replies).toHaveLength(1)
    expect(json.thread.replies[0]!.isInternalNote).toBe(false)
  })

  it("returns only public replies for tenant admins on requester console", async () => {
    const publicReply = {
      id: "reply_public",
      ticketId: "ticket_1",
      authorWorkosUserId: "user_1",
      body: "This is a public reply",
      secureForm: null,
      isInternalNote: false,
      attachmentMetadata: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Tenant admin (platformRole "none") is not a super_admin, so the
    // service returns only public replies. The route test verifies the
    // response structure is correct.
    const app = createAdminApp({
      async getTicketThread() {
        return {
          ticket: baseTicket,
          replies: [publicReply],
        }
      },
    }, "none")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const json = (await response.json()) as SupportTicketThreadResponse
    expect(json.ok).toBe(true)
    expect(json.thread.replies).toHaveLength(1)
    expect(json.thread.replies[0]!.isInternalNote).toBe(false)
  })

  it("returns 401 when user is not authenticated", async () => {
    const app = new Elysia().use(
      createSupportTicketRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          role: "member",
          roles: ["member"],
          user: null,
        }),
        getPlatformRole: async () => "none",
        service: {
          async listTickets() { throw new Error("should not reach") },
          async createTicket() { throw new Error("should not reach") },
          async getTicketThread() { throw new Error("should not reach") },
          async addReply() { throw new Error("should not reach") },
          async transitionStatus() { throw new Error("should not reach") },
        } as Partial<SupportTicketService> as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "GET",
      })
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    })
  })

  it("returns 403 when user has no organization context", async () => {
    const app = new Elysia().use(
      createSupportTicketRoutes({
        authenticate: async () => ({
          organizationId: null,
          role: null,
          roles: null,
          user: {
            id: "user_1",
            email: "user@example.com",
          },
        }),
        getPlatformRole: async () => "none",
        service: {
          async listTickets() { throw new Error("should not reach") },
          async createTicket() { throw new Error("should not reach") },
          async getTicketThread() { throw new Error("should not reach") },
          async addReply() { throw new Error("should not reach") },
          async transitionStatus() { throw new Error("should not reach") },
        } as Partial<SupportTicketService> as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "GET",
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "TENANT_CONTEXT_REQUIRED",
    })
  })

  it("maps content unavailable error to 503", async () => {
    const { SupportTicketContentUnavailableError: ContentUnavailableError } = await import(
      "@/modules/support-tickets/support-ticket.service"
    )

    const app = new Elysia().use(
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
            throw new ContentUnavailableError()
          },
        } as Partial<SupportTicketService> as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "GET",
      })
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "CONTENT_UNAVAILABLE",
    })
  })

  it("returns 422 with field errors for invalid input", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject: "",
          department: "invalid_dept",
          priority: "medium",
        }),
      })
    )

    expect(response.status).toBe(422)
    const text = await response.text()
    expect(text).toBeTruthy()
  })

  it("lists organizations when super admin requests admin/organizations", async () => {
    const app = createAdminApp({}, "super_admin")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin/organizations", {
        method: "GET",
      })
    )

    expect(response.status).toBe(200)
    const json = await response.json() as Record<string, unknown>
    expect(json.ok).toBe(true)
    expect(json.organizations).toBeDefined()
  })
})
