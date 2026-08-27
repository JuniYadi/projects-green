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

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const mockGroupFindMany = mock(() => Promise.resolve([]))
const mockGroupFindFirst = mock(() => Promise.resolve(null))
const mockGroupCreate = mock(() => Promise.resolve({}))
const mockGroupUpdate = mock(() => Promise.resolve({}))
const mockGroupDelete = mock(() => Promise.resolve({}))
const mockContactCount = mock(() => Promise.resolve(0))
mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappContactGroup: {
      findMany: mockGroupFindMany,
      findFirst: mockGroupFindFirst,
      create: mockGroupCreate,
      update: mockGroupUpdate,
      delete: mockGroupDelete,
    },
    whatsappContact: {
      count: mockContactCount,
    },
  },
}))

const mockLogWhatsappAuditEvent = mock(() => Promise.resolve({}))
mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogWhatsappAuditEvent,
}))

const { groupsRoutes } = await import("./groups.route")

function createTestApp() {
  return new Elysia().use(groupsRoutes)
}

describe("groups.route", () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    mockAuthContext.current = null
    mockGroupFindMany.mockClear()
    mockGroupFindFirst.mockClear()
    mockGroupCreate.mockClear()
    mockGroupUpdate.mockClear()
    mockGroupDelete.mockClear()
    mockLogWhatsappAuditEvent.mockClear()
    app = createTestApp()
  })

  describe("GET /groups", () => {
    it("returns 401 when unauthorized", async () => {
      const res = await app.handle(new Request("http://localhost/groups"))
      expect(res.status).toBe(401)
    })

    it("lists groups for organization", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockGroupFindMany.mockResolvedValueOnce([
        { id: "grp-1", name: "VIP Customers" },
      ] as unknown as never)

      const res = await app.handle(new Request("http://localhost/groups"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        groups: [{ id: "grp-1", name: "VIP Customers" }],
      })
    })
  })

  describe("GET /groups/:id", () => {
    it("returns 404 when group not found", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockGroupFindFirst.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/groups/grp-404")
      )

      expect(res.status).toBe(404)
    })

    it("returns group when authorized", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
      }
      mockGroupFindFirst.mockResolvedValueOnce({
        id: "grp-1",
        organizationId: "org-1",
        name: "VIP",
      } as unknown as never)

      const res = await app.handle(new Request("http://localhost/groups/grp-1"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.group.name).toBe("VIP")
    })
  })

  describe("POST /groups", () => {
    it("creates a new contact group", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }
      mockGroupCreate.mockResolvedValueOnce({
        id: "grp-new",
        name: "New Group",
        organizationId: "org-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/groups", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "New Group",
            description: "Some description",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(mockLogWhatsappAuditEvent).toHaveBeenCalled()
    })
  })

  describe("PATCH /groups/:id", () => {
    it("updates contact group", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }
      mockGroupFindFirst.mockResolvedValueOnce({
        id: "grp-1",
        organizationId: "org-1",
      } as unknown as never)
      mockGroupUpdate.mockResolvedValueOnce({
        id: "grp-1",
        name: "Updated Group",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/groups/grp-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Updated Group",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(mockGroupUpdate).toHaveBeenCalled()
    })
  })

  describe("DELETE /groups/:id", () => {
    it("deletes contact group", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }
      mockGroupFindFirst.mockResolvedValueOnce({
        id: "grp-1",
        organizationId: "org-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/groups/grp-1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ ok: true, message: "Group deleted." })
      expect(mockGroupDelete).toHaveBeenCalledWith({
        where: { id: "grp-1" },
      })
    })
  })
})
