import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { workosNodeMock } from "../../../../test/workos-node-mock"

const mockAuthContext = {
  current: null as {
    organizationId?: string
    type: string
    userId?: string
    role?: string
    orgRole?: string
  } | null,
}

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

mock.module("@/lib/auth/org-role", () => ({
  resolveOrgRole: async () => mockAuthContext.current?.orgRole ?? "admin",
}))

const mockListWhatsAppUsers = mock(() => Promise.resolve([]))
const mockGetWhatsAppUser = mock(() => Promise.resolve(null))
const mockInviteWhatsAppUser = mock(() => Promise.resolve({}))
const mockUpdateWhatsAppUserRole = mock(() => Promise.resolve({}))
const mockRemoveWhatsAppUser = mock(() => Promise.resolve())

mock.module("../users.service", () => ({
  listWhatsAppUsers: mockListWhatsAppUsers,
  getWhatsAppUser: mockGetWhatsAppUser,
  inviteWhatsAppUser: mockInviteWhatsAppUser,
  updateWhatsAppUserRole: mockUpdateWhatsAppUserRole,
  removeWhatsAppUser: mockRemoveWhatsAppUser,
}))

const { usersRoutes } = await import("./users.route")

function createTestApp() {
  return new Elysia().use(usersRoutes)
}

describe("whatsapp users.route", () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    mockAuthContext.current = null
    mockListWhatsAppUsers.mockClear()
    mockGetWhatsAppUser.mockClear()
    mockInviteWhatsAppUser.mockClear()
    mockUpdateWhatsAppUserRole.mockClear()
    mockRemoveWhatsAppUser.mockClear()
    app = createTestApp()
  })

  describe("GET /users", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await app.handle(new Request("http://localhost/users"))
      expect(res.status).toBe(401)
    })

    it("returns list of users for organization", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }
      mockListWhatsAppUsers.mockResolvedValueOnce([
        { id: "mem-1", email: "user@example.com", role: "member" },
      ] as unknown as never)

      const res = await app.handle(new Request("http://localhost/users"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.users).toHaveLength(1)
    })
  })

  describe("POST /users (Invite)", () => {
    it("invites new user", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockInviteWhatsAppUser.mockResolvedValueOnce({
        id: "inv-1",
        email: "invitee@example.com",
        roleSlug: "member",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "invitee@example.com",
            role: "member",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.invitation.email).toBe("invitee@example.com")
    })
  })

  describe("GET /users/:id", () => {
    it("gets single user details", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
      }
      mockGetWhatsAppUser.mockResolvedValueOnce({
        id: "mem-1",
        organizationId: "org-1",
        email: "user@example.com",
      } as unknown as never)

      const res = await app.handle(new Request("http://localhost/users/mem-1"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.user.email).toBe("user@example.com")
    })
  })

  describe("PATCH /users/:id", () => {
    it("updates role when caller is admin/owner", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "admin-1",
        orgRole: "admin",
      }
      mockGetWhatsAppUser.mockResolvedValueOnce({
        id: "mem-1",
        organizationId: "org-1",
      } as unknown as never)
      mockUpdateWhatsAppUserRole.mockResolvedValueOnce({
        id: "mem-1",
        role: "admin",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/users/mem-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role: "admin" }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  describe("DELETE /users/:id", () => {
    it("removes user membership", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "admin-1",
        orgRole: "admin",
      }
      mockGetWhatsAppUser.mockResolvedValueOnce({
        id: "mem-1",
        organizationId: "org-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/users/mem-1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(mockRemoveWhatsAppUser).toHaveBeenCalledWith("mem-1")
    })
  })
})
