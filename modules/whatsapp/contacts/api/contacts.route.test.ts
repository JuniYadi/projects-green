import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { workosNodeMock } from "../../../../test/workos-node-mock"
const mockAuthContext = {
  current: null as {
    organizationId?: string
    type: string
    userId?: string
  } | null,
}

function setMockAuthContext(ctx: any) {
  mockAuthContext.current = ctx
}

function postContact(body: Record<string, unknown>) {
  return new Request("http://localhost/contacts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const mockGroupFindFirst = mock(async () => ({
  id: "group_default",
  organizationId: "org_1",
  name: "Ungrouped",
}))
const mockGroupCreate = mock(async () => ({
  id: "group_default",
  organizationId: "org_1",
  name: "Ungrouped",
}))
const mockContactFindFirst = mock(async () => null)
const mockContactFindMany = mock(async () => [])
const mockContactCount = mock(async () => 0)
const mockContactCreate = mock(async (args: any) => ({
  id: "contact_1",
  ...args.data,
}))
const mockContactUpdate = mock(async (args: any) => ({
  id: "contact_1",
  ...args.data,
}))
const mockContactDelete = mock(async () => ({}))
const mockConversationFindMany = mock(async () => [])

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappContactGroup: {
      findFirst: mockGroupFindFirst,
      create: mockGroupCreate,
    },
    whatsappContact: {
      findFirst: mockContactFindFirst,
      findMany: mockContactFindMany,
      count: mockContactCount,
      create: mockContactCreate,
      update: mockContactUpdate,
      delete: mockContactDelete,
    },
    whatsappConversation: {
      findMany: mockConversationFindMany,
    },
  },
}))

const mockLogWhatsappAuditEvent = mock(async () => {})
mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogWhatsappAuditEvent,
}))

const { contactsRoutes } = await import("./contacts.route")

function createTestApp() {
  return new Elysia().use(contactsRoutes)
}

describe("contacts routes", () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    mockAuthContext.current = null
    mockGroupFindFirst.mockClear()
    mockGroupCreate.mockClear()
    mockContactFindFirst.mockClear()
    mockContactFindMany.mockClear()
    mockContactCount.mockClear()
    mockContactCreate.mockClear()
    mockContactUpdate.mockClear()
    mockContactDelete.mockClear()
    mockConversationFindMany.mockClear()
    mockLogWhatsappAuditEvent.mockClear()
    app = createTestApp()
  })

  describe("GET /contacts", () => {
    it("returns 401 when unauthorized", async () => {
      const res = await app.handle(new Request("http://localhost/contacts"))
      expect(res.status).toBe(401)
    })

    it("lists contacts with pagination and conversation enrichment", async () => {
      mockAuthContext.current = {
        organizationId: "org_1",
        type: "workos",
        userId: "user_1",
      }
      mockContactCount.mockResolvedValueOnce(1 as unknown as never)
      mockContactFindMany.mockResolvedValueOnce([
        {
          id: "contact_1",
          organizationId: "org_1",
          name: "John Doe",
          phoneNumber: "6281234567890",
          email: "john@example.com",
          status: "ACTIVE",
          contactGroupId: "group_1",
          createdAt: new Date(),
          updatedAt: new Date(),
          dynamicValues: null,
          dynamicRaw: null,
          whatsappDeviceId: null,
          contactGroup: { id: "group_1", name: "VIP" },
        },
      ] as unknown as never)

      mockConversationFindMany.mockResolvedValueOnce([
        {
          contactPhone: "6281234567890",
          lastMessageAt: new Date(),
          lastDirection: "INBOUND",
          whatsappMessages: [{ body: "Hello!", messageType: "text" }],
        },
      ] as unknown as never)

      const res = await app.handle(new Request("http://localhost/contacts"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].lastMessage).toBe("Hello!")
    })
  })

  describe("GET /contacts/:id", () => {
    it("returns 404 when contact not found", async () => {
      mockAuthContext.current = {
        organizationId: "org_1",
        type: "workos",
        userId: "user_1",
      }
      mockContactFindFirst.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/contacts/c_404")
      )

      expect(res.status).toBe(404)
    })

    it("returns contact when found", async () => {
      mockAuthContext.current = {
        organizationId: "org_1",
        type: "workos",
        userId: "user_1",
      }
      mockContactFindFirst.mockResolvedValueOnce({
        id: "contact_1",
        organizationId: "org_1",
        name: "John Doe",
        phoneNumber: "6281234567890",
        email: "john@example.com",
        status: "ACTIVE",
        contactGroupId: "group_1",
        createdAt: new Date(),
        updatedAt: new Date(),
        dynamicValues: null,
        dynamicRaw: null,
        whatsappDeviceId: null,
        contactGroup: { id: "group_1", name: "VIP" },
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/contacts/contact_1")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.contact.name).toBe("John Doe")
    })
  })

  describe("POST /contacts", () => {
    it("creates a new contact", async () => {
      mockAuthContext.current = {
        organizationId: "org_1",
        type: "workos",
        userId: "user_1",
      }
      mockContactFindFirst.mockResolvedValueOnce(null)
      mockContactCreate.mockResolvedValueOnce({
        id: "contact_1",
        organizationId: "org_1",
        name: "Alice",
        phoneNumber: "6281234567890",
        email: "alice@example.com",
        status: "ACTIVE",
        contactGroupId: "group_default",
        createdAt: new Date(),
        updatedAt: new Date(),
        dynamicValues: null,
        dynamicRaw: null,
        whatsappDeviceId: null,
        contactGroup: { id: "group_default", name: "Ungrouped" },
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/contacts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Alice",
            phoneNumber: "6281234567890",
            email: "alice@example.com",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.contact.name).toBe("Alice")
      expect(mockLogWhatsappAuditEvent).toHaveBeenCalled()
    })
  })

  describe("PATCH /contacts/:id", () => {
    it("updates contact", async () => {
      mockAuthContext.current = {
        organizationId: "org_1",
        type: "workos",
        userId: "user_1",
      }
      mockContactFindFirst.mockResolvedValueOnce({
        id: "contact_1",
        organizationId: "org_1",
      } as unknown as never)
      mockContactUpdate.mockResolvedValueOnce({
        id: "contact_1",
        organizationId: "org_1",
        name: "Alice Updated",
        phoneNumber: "6281234567890",
        email: "alice@example.com",
        status: "ACTIVE",
        contactGroupId: "group_default",
        createdAt: new Date(),
        updatedAt: new Date(),
        dynamicValues: null,
        dynamicRaw: null,
        whatsappDeviceId: null,
        contactGroup: { id: "group_default", name: "Ungrouped" },
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/contacts/contact_1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Alice Updated",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.contact.name).toBe("Alice Updated")
    })
  })

  describe("DELETE /contacts/:id", () => {
    it("deletes contact", async () => {
      mockAuthContext.current = {
        organizationId: "org_1",
        type: "workos",
        userId: "user_1",
      }
      mockContactFindFirst.mockResolvedValueOnce({
        id: "contact_1",
        organizationId: "org_1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/contacts/contact_1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ ok: true, message: "Contact deleted." })
      expect(mockContactDelete).toHaveBeenCalledWith({
        where: { id: "contact_1" },
      })
    })
  })

  // ─── Edge cases from previous suite ─────────────────────────────
  describe("contacts routes — create", () => {
    beforeEach(() => {
      mockGroupFindFirst.mockClear()
      mockGroupCreate.mockClear()
      mockContactFindFirst.mockClear()
      mockContactCreate.mockClear()
      mockGroupFindFirst.mockImplementation(async () => null)
      mockGroupCreate.mockImplementation(async () => ({
        id: "group_default",
        organizationId: "org_1",
        name: "Ungrouped",
      }))
      mockContactFindFirst.mockImplementation(async () => null)
      mockContactCreate.mockImplementation(async (args: any) => ({
        id: "contact_1",
        ...args.data,
      }))
      setMockAuthContext({
        type: "workos",
        userId: "user_1",
        email: "admin@example.com",
        organizationId: "org_1",
        orgRole: "admin",
        platformRole: "none",
      })
    })

    it("auto-assigns a default audience when no group is provided", async () => {
      const app = createTestApp()

      const response = await app.handle(
        postContact({
          phoneNumber: "+62811111111",
          name: "John Doe",
          email: "john@example.com",
        })
      )

      expect(response.status).toBe(200)
      const payload = (await response.json()) as {
        ok: boolean
        contact: { contactGroupId: string }
      }
      expect(payload.ok).toBe(true)
      expect(payload.contact.contactGroupId).toBe("group_default")
      // Default group was created because none existed yet.
      expect(mockGroupCreate).toHaveBeenCalledTimes(1)
    })

    it("reuses an existing default audience group instead of recreating it", async () => {
      mockGroupFindFirst.mockImplementation(async () => ({
        id: "group_existing_default",
        organizationId: "org_1",
        name: "Ungrouped",
      }))

      const app = createTestApp()

      const response = await app.handle(
        postContact({
          phoneNumber: "+62822222222",
          name: "Jane Doe",
          email: "jane@example.com",
        })
      )

      expect(response.status).toBe(200)
      const payload = (await response.json()) as {
        contact: { contactGroupId: string }
      }
      expect(payload.contact.contactGroupId).toBe("group_existing_default")
      expect(mockGroupCreate).not.toHaveBeenCalled()
    })

    it("uses the provided group when it belongs to the organization", async () => {
      mockGroupFindFirst.mockImplementation(async () => ({
        id: "group_provided",
        organizationId: "org_1",
        name: "VIP",
      }))

      const app = createTestApp()

      const response = await app.handle(
        postContact({
          phoneNumber: "+62833333333",
          name: "VIP Contact",
          email: "vip@example.com",
          contactGroupId: "group_provided",
        })
      )

      expect(response.status).toBe(200)
      const payload = (await response.json()) as {
        contact: { contactGroupId: string }
      }
      expect(payload.contact.contactGroupId).toBe("group_provided")
      expect(mockGroupCreate).not.toHaveBeenCalled()
    })

    it("rejects a provided group that does not belong to the organization", async () => {
      mockGroupFindFirst.mockImplementation(async () => null)

      const app = createTestApp()

      const response = await app.handle(
        postContact({
          phoneNumber: "+62844444444",
          name: "Bad Group",
          email: "bad@example.com",
          contactGroupId: "group_other_org",
        })
      )

      expect(response.status).toBe(400)
      const payload = (await response.json()) as { error: string }
      expect(payload.error).toBe("BAD_REQUEST")
      expect(mockContactCreate).not.toHaveBeenCalled()
    })
  })
})
