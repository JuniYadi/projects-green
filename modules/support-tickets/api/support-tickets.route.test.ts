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

mock.module("@/lib/workos-directory", () => ({
  getCachedUsers: mock(async () => new Map()),
  getCachedOrganizations: mock(
    async (ids: string[]) =>
      new Map(
        ids.map((id) => [
          id,
          { id, name: id === "org_1" ? "Org One" : null, slug: id },
        ])
      )
  ),
}))

const mockListTenantMemberships = mock<
  () => Promise<
    Array<{
      userId: string
      email: string
      displayName: string
      role: string
      status: string
      workosUserId: string
    }>
  >
>(async () => [])

mock.module("@/modules/tenants/services/tenant-workos.service", () => ({
  listTenantMemberships: mockListTenantMemberships,
}))

import { createSupportTicketRoutes } from "@/modules/support-tickets/api/support-tickets.route"
import {
  SupportTicketAccessDeniedError,
  SupportTicketNotFoundError,
  type SupportTicketService,
} from "@/modules/support-tickets/support-ticket.service"
import type {
  SupportTicket,
  SupportTicketReply,
} from "@/modules/support-tickets/support-ticket.types"

type SupportTicketThreadResponse = {
  ok: true
  thread: {
    ticket: SupportTicket
    replies: Array<{
      id: string
      authorWorkosUserId: string
      isInternalNote: boolean
      organizationName?: string | null
    }>
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

const mockSendTicketReplyAlertToStaff = mock(async () => {})
const mockSendNewTicketAlertToStaff = mock(async () => {})

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
      resolveSupportRecipients: async () => [
        { email: "admin1@example.com" },
        { email: "admin2@example.com" },
      ],
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
        sendNewTicketAlertToStaff: mockSendNewTicketAlertToStaff,
        sendTicketReplyAlertToStaff: mockSendTicketReplyAlertToStaff,
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

  it("creates ticket and sends admin alert", async () => {
    mockSendNewTicketAlertToStaff.mockClear()
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
    expect(mockSendNewTicketAlertToStaff).toHaveBeenCalledTimes(2)
  })

  it("sends staff reply alert when requester self-replies to their own ticket", async () => {
    mockSendTicketReplyAlertToStaff.mockClear()
    mockSendNewTicketAlertToStaff.mockClear()

    const app = createApp({
      async getTicketThread() {
        return {
          ticket: baseTicket,
          replies: [],
        }
      },
      async addReply() {
        return {
          id: "reply_2",
          ticketId: "ticket_1",
          authorWorkosUserId: "user_1",
          body: "Thanks for the update",
          secureForm: null,
          isInternalNote: false,
          attachmentMetadata: [],
          createdAt: new Date("2026-05-21T02:00:00.000Z"),
          updatedAt: new Date("2026-05-21T02:00:00.000Z"),
        }
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1/replies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "Thanks for the update" }),
      })
    )

    expect(response.status).toBe(201)
    expect(mockSendTicketReplyAlertToStaff).toHaveBeenCalledTimes(2)
    const calls = mockSendTicketReplyAlertToStaff.mock
      .calls as unknown as Array<
      [SupportTicket, SupportTicketReply, string, string | undefined]
    >
    expect(calls[0]![0].id).toBe("ticket_1")
    expect(calls[0]![1].id).toBe("reply_2")
    expect(calls[0]![2]).toBe("admin1@example.com")
    expect(calls[0]![3]).toBeUndefined()
    expect(calls[1]![2]).toBe("admin2@example.com")
  })

  it("does not send staff reply alert when adding an internal note", async () => {
    mockSendTicketReplyAlertToStaff.mockClear()
    mockSendNewTicketAlertToStaff.mockClear()

    const app = createApp({
      async getTicketThread() {
        return {
          ticket: baseTicket,
          replies: [],
        }
      },
      async addReply() {
        return {
          id: "reply_3",
          ticketId: "ticket_1",
          authorWorkosUserId: "user_1",
          body: "Internal note for support team",
          secureForm: null,
          isInternalNote: true,
          attachmentMetadata: [],
          createdAt: new Date("2026-05-21T03:00:00.000Z"),
          updatedAt: new Date("2026-05-21T03:00:00.000Z"),
        }
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1/replies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: "Internal note for support team",
          isInternalNote: true,
        }),
      })
    )

    expect(response.status).toBe(201)
    expect(mockSendTicketReplyAlertToStaff).not.toHaveBeenCalled()
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

  const createAdminApp = (
    service: Partial<SupportTicketService>,
    platformRole: "none" | "super_admin"
  ) => {
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
          async listTickets() {
            return []
          },
          async createTicket() {
            return baseTicket
          },
          async getTicketThread() {
            return { ticket: baseTicket, replies: [] }
          },
          async addReply() {
            return {
              id: "reply_1",
              ticketId: "ticket_1",
              authorWorkosUserId: "user_1",
              body: "Ok",
              secureForm: null,
              isInternalNote: false,
              attachmentMetadata: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          },
          async transitionStatus() {
            return baseTicket
          },
          async listAllTickets() {
            return {
              tickets: [baseTicket],
              total: 1,
              page: 1,
              pageSize: 20,
            }
          },
          async updateTicket() {
            return baseTicket
          },
          async deleteTicket() {
            return true
          },
          ...service,
        } as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
          async sendTicketReplyAlertToStaff() {},
          async sendNewTicketAlertToStaff() {},
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
  it("returns admin list pagination metadata and organization name", async () => {
    const app = createAdminApp(
      {
        async listAllTickets(input) {
          return {
            tickets: [{ ...baseTicket, organizationId: "org_1" }],
            total: 7,
            page: input.page ?? 1,
            pageSize: input.pageSize ?? 20,
          }
        },
      },
      "super_admin"
    )

    const response = await app.handle(
      new Request(
        "http://localhost/support-tickets/admin?page=2&pageSize=20&includeClosed=1",
        { method: "GET" }
      )
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      total: 7,
      page: 2,
      pageSize: 20,
      tickets: [{ organizationName: "Org One" }],
    })
  })

  it("returns null organizationName when directory lookup misses", async () => {
    const app = createAdminApp(
      {
        async listAllTickets() {
          return {
            tickets: [{ ...baseTicket, organizationId: "org_missing" }],
            total: 1,
            page: 1,
            pageSize: 20,
          }
        },
      },
      "super_admin"
    )

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin", { method: "GET" })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      tickets: [{ organizationName: null }],
    })
  })

  it("super admin can filter /support-tickets/admin by organizationId", async () => {
    let receivedOrganizationId: string | undefined
    let receivedActorOrganizationId: string | undefined
    const app = createAdminApp(
      {
        async listAllTickets(input) {
          receivedOrganizationId = input.organizationId
          receivedActorOrganizationId = input.actor.organizationId
          return {
            tickets: [
              { ...baseTicket, id: "t1", organizationId: "org_custom" },
              { ...baseTicket, id: "t2", organizationId: "org_custom" },
            ],
            total: 2,
            page: input.page ?? 1,
            pageSize: input.pageSize ?? 20,
          }
        },
      },
      "super_admin"
    )

    const response = await app.handle(
      new Request(
        "http://localhost/support-tickets/admin?organizationId=org_custom",
        {
          method: "GET",
        }
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.tickets).toHaveLength(2)
    expect(
      body.tickets.every(
        (t: { organizationId: string }) => t.organizationId === "org_custom"
      )
    ).toBe(true)
    expect(receivedOrganizationId).toBe("org_custom")
    // super_admin actor still has its auth tenant id; the filter is the
    // explicit organizationId param, not the actor's tenant.
    expect(receivedActorOrganizationId).toBe("org_1")
  })

  it("creates ticket for custom organization as admin", async () => {
    let createdWithOrg = ""
    const app = createAdminApp(
      {
        async createTicket(input) {
          createdWithOrg = input.organizationId
          return {
            ...baseTicket,
            organizationId: input.organizationId,
          }
        },
      },
      "super_admin"
    )

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
    const app = createAdminApp(
      {
        async updateTicket(input) {
          updatedFields = input.data
          return {
            ...baseTicket,
            ...input.data,
          } as unknown as SupportTicket
        },
      },
      "super_admin"
    )

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
    const app = createAdminApp(
      {
        async deleteTicket(input) {
          deletedId = input.ticketId
          return true
        },
      },
      "super_admin"
    )

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
          async listTickets() {
            return [baseTicket]
          },
          async createTicket() {
            return baseTicket
          },
          async getTicketThread() {
            return { ticket: baseTicket, replies: [] }
          },
          async addReply() {
            return {
              id: "reply_1",
              ticketId: "ticket_1",
              authorWorkosUserId: "user_1",
              body: "Ok",
              secureForm: null,
              isInternalNote: false,
              attachmentMetadata: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          },
          async transitionStatus() {
            return baseTicket
          },
          async listAllTickets() {
            return {
              tickets: [baseTicket],
              total: 1,
              page: 1,
              pageSize: 20,
            }
          },
          async updateTicket() {
            return baseTicket
          },
          async deleteTicket() {
            return true
          },
        } as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
          async sendTicketReplyAlertToStaff() {},
          async sendNewTicketAlertToStaff() {},
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

    const app = createAdminApp(
      {
        async getTicketThread() {
          return {
            ticket: baseTicket,
            replies: [internalNoteReply, publicReply],
          }
        },
      },
      "super_admin"
    )

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
    const app = createAdminApp(
      {
        async getTicketThread() {
          return {
            ticket: baseTicket,
            replies: [publicReply],
          }
        },
      },
      "none"
    )

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
          async listTickets() {
            throw new Error("should not reach")
          },
          async createTicket() {
            throw new Error("should not reach")
          },
          async getTicketThread() {
            throw new Error("should not reach")
          },
          async addReply() {
            throw new Error("should not reach")
          },
          async transitionStatus() {
            throw new Error("should not reach")
          },
        } as Partial<SupportTicketService> as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
          async sendTicketReplyAlertToStaff() {},
          async sendNewTicketAlertToStaff() {},
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
          async listTickets() {
            throw new Error("should not reach")
          },
          async createTicket() {
            throw new Error("should not reach")
          },
          async getTicketThread() {
            throw new Error("should not reach")
          },
          async addReply() {
            throw new Error("should not reach")
          },
          async transitionStatus() {
            throw new Error("should not reach")
          },
        } as Partial<SupportTicketService> as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
          async sendTicketReplyAlertToStaff() {},
          async sendNewTicketAlertToStaff() {},
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
    const { SupportTicketContentUnavailableError: ContentUnavailableError } =
      await import("@/modules/support-tickets/support-ticket.service")

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
          async sendTicketReplyAlertToStaff() {},
          async sendNewTicketAlertToStaff() {},
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
    const json = (await response.json()) as Record<string, unknown>
    expect(json.ok).toBe(true)
    expect(json.organizations).toBeDefined()
  })

  it("rethrows unknown errors from toErrorResponse", async () => {
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
            throw new TypeError("Something unexpected")
          },
        } as Partial<SupportTicketService> as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
          async sendTicketReplyAlertToStaff() {},
          async sendNewTicketAlertToStaff() {},
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "GET",
      })
    )

    // Unknown errors are re-thrown — Elysia converts them to 500
    expect(response.status).toBe(500)
  })

  it("handles admin/organizations error gracefully", async () => {
    const mockFailListOrg = mock(async () => {
      throw new Error("WorkOS API failure")
    })

    mock.module("@workos-inc/authkit-nextjs", () => {
      return {
        withAuth: async () => ({
          organizationId: "org_1",
          role: "member",
          roles: ["member"],
          user: {
            id: "user_admin",
            email: "admin@example.com",
          },
        }),
        getWorkOS: () => ({
          userManagement: {
            getUser: mockGetUser,
            listOrganizationMemberships: mockListOrganizationMemberships,
          },
          organizations: {
            getOrganization: async () => ({ id: "org_1", name: "Org 1" }),
            listOrganizations: mockFailListOrg,
          },
        }),
      }
    })

    const app = createAdminApp({}, "super_admin")

    const response = await app.handle(
      new Request("http://localhost/support-tickets/admin/organizations", {
        method: "GET",
      })
    )

    expect(response.status).toBe(500)
    const json = (await response.json()) as Record<string, unknown>
    expect(json.error).toBe("INTERNAL_SERVER_ERROR")
  })

  it("creates ticket without requester email", async () => {
    const app = new Elysia().use(
      createSupportTicketRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          role: "member",
          roles: ["member"],
          user: {
            id: "user_noemail",
            email: null,
          },
        }),
        getPlatformRole: async () => "none",
        resolveSupportRecipients: async () => [],
        service: {
          async listTickets() {
            return []
          },
          async createTicket() {
            return baseTicket
          },
          async getTicketThread() {
            return { ticket: baseTicket, replies: [] }
          },
          async addReply() {
            return {
              id: "reply_1",
              ticketId: "ticket_1",
              authorWorkosUserId: "user_1",
              body: "Ok",
              secureForm: null,
              isInternalNote: false,
              attachmentMetadata: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          },
          async transitionStatus() {
            return baseTicket
          },
        } as Partial<SupportTicketService> as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
          async sendTicketReplyAlertToStaff() {},
          async sendNewTicketAlertToStaff() {},
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: "No email test",
          department: "technical",
          priority: "medium",
        }),
      })
    )

    expect(response.status).toBe(201)
  })

  it("handles resolveRequesterEmail failure gracefully in close", async () => {
    const mockFailGetUser = mock(async () => {
      throw new Error("WorkOS user service down")
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
            getUser: mockFailGetUser,
            listOrganizationMemberships: mockListOrganizationMemberships,
          },
          organizations: {
            getOrganization: async () => ({ id: "org_1", name: "Org 1" }),
            listOrganizations: async () => ({ data: [] }),
          },
        }),
      }
    })

    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1/close", {
        method: "POST",
      })
    )

    // The close should still succeed even if resolveRequesterEmail fails
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      ticket: { status: "closed" },
    })
  })
  it("accepts secure-only reply with empty body and normalizes to SECURE_ONLY_REPLY_BODY", async () => {
    let capturedBody = ""
    let capturedSecureForm = ""
    const app = createApp({
      async getTicketThread() {
        return { ticket: baseTicket, replies: [] }
      },
      async addReply(input: {
        actor: unknown
        reply: { body: string; secureForm?: string | null }
      }) {
        capturedBody = input.reply.body
        capturedSecureForm = String(input.reply.secureForm ?? "")
        return {
          id: "reply_secure",
          ticketId: "ticket_1",
          authorWorkosUserId: "user_1",
          body: "details on secure message",
          secureForm: "secret",
          isInternalNote: false,
          attachmentMetadata: [],
          createdAt: new Date("2026-05-21T02:00:00.000Z"),
          updatedAt: new Date("2026-05-21T02:00:00.000Z"),
        }
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1/replies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "", secureForm: "secret" }),
      })
    )

    expect(response.status).toBe(201)
    expect(capturedBody).toBe("details on secure message")
    expect(capturedSecureForm).toBe("secret")
  })

  it("rejects reply with both empty body and empty secureForm", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets/ticket_1/replies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "", secureForm: "" }),
      })
    )

    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})

import {
  normalizeEmail,
  dedupeRecipients,
  excludeRecipient,
} from "@/modules/support-tickets/api/support-tickets.route"

describe("route helper functions", () => {
  it("normalizeEmail trims and lowercases", () => {
    expect(normalizeEmail("  Alice@Example.COM  ")).toBe("alice@example.com")
    expect(normalizeEmail(null)).toBe("")
    expect(normalizeEmail(undefined)).toBe("")
    expect(normalizeEmail("")).toBe("")
  })

  it("dedupeRecipients removes duplicate normalized emails", () => {
    const result = dedupeRecipients([
      { email: "alice@example.com", name: "Alice", role: "owner" },
      { email: "ALICE@example.com", name: "Alice2", role: "admin" },
      { email: "", name: "Empty", role: "admin" },
      { email: "bob@example.com", name: "Bob", role: "admin" },
    ])
    expect(result).toHaveLength(2)
    expect(result[0]!.email).toBe("alice@example.com")
    expect(result[1]!.email).toBe("bob@example.com")
  })

  it("excludeRecipient filters by workosUserId and email", () => {
    const recipients = [
      {
        email: "alice@example.com",
        workosUserId: "u1",
        name: "A",
        role: "owner" as const,
      },
      {
        email: "bob@example.com",
        workosUserId: "u2",
        name: "B",
        role: "admin" as const,
      },
      {
        email: "carol@example.com",
        workosUserId: "u3",
        name: "C",
        role: "admin" as const,
      },
    ]
    const result = excludeRecipient(recipients, {
      workosUserId: "u1",
      email: "carol@example.com",
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.email).toBe("bob@example.com")
  })

  it("excludeRecipient handles missing exclusion criteria", () => {
    const recipients = [
      {
        email: "a@example.com",
        workosUserId: "u1",
        name: "A",
        role: "owner" as const,
      },
      {
        email: "b@example.com",
        workosUserId: "u2",
        name: "B",
        role: "admin" as const,
      },
    ]
    const result = excludeRecipient(recipients, {})
    expect(result).toHaveLength(2)
  })
  it("resolves recipients via WorkOS listTenantMemberships", async () => {
    mockListTenantMemberships.mockReset()
    mockListTenantMemberships.mockResolvedValueOnce([
      {
        userId: "u1",
        email: "owner@example.com",
        displayName: "Owner",
        role: "owner",
        status: "active",
        workosUserId: "u1",
      },
      {
        userId: "u2",
        email: "admin@example.com",
        displayName: "Admin",
        role: "admin",
        status: "active",
        workosUserId: "u2",
      },
    ])
    const mockSendStaff = mock(async () => {})
    const app = new Elysia().use(
      createSupportTicketRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          role: "member",
          roles: ["member"],
          user: { id: "u2", email: "admin@example.com" },
        }),
        getPlatformRole: async () => "none",
        service: {
          async listTickets() {
            return []
          },
          async createTicket() {
            return baseTicket
          },
          async getTicketThread() {
            return { ticket: baseTicket, replies: [] }
          },
          async addReply() {
            return {
              id: "r1",
              ticketId: "t1",
              authorWorkosUserId: "u2",
              body: "x",
              secureForm: null,
              isInternalNote: false,
              attachmentMetadata: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          },
          async transitionStatus() {
            return baseTicket
          },
          async listAllTickets() {
            return { tickets: [], total: 0, page: 1, pageSize: 20 }
          },
          async updateTicket() {
            return baseTicket
          },
          async deleteTicket() {
            return true
          },
        } as SupportTicketService,
        emailService: {
          async sendTicketCreated() {},
          async sendTicketReplied() {},
          async sendTicketClosed() {},
          sendNewTicketAlertToStaff: mockSendStaff,
          sendTicketReplyAlertToStaff: mock(async () => {}),
        },
      })
    )

    const res = await app.handle(
      new Request("http://localhost/support-tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: "Test",
          department: "technical",
          priority: "high",
        }),
      })
    )
    expect(res.status).toBe(201)
    expect(mockSendStaff).toHaveBeenCalledTimes(1)
    expect((mockSendStaff.mock.calls[0] as unknown[])[1]).toBe(
      "owner@example.com"
    )
    mockListTenantMemberships.mockReset()
  })
})
