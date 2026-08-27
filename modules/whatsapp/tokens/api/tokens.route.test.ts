import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { workosNodeMock } from "../../../../test/workos-node-mock"

const mockAuthContext = {
  current: null as {
    organizationId?: string
    type: string
    userId?: string
    platformRole?: string
  } | null,
}

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const mockFindMany = mock(() => Promise.resolve([]))
const mockFindUnique = mock(() => Promise.resolve(null))
const mockCreate = mock(() => Promise.resolve({}))
const mockUpdate = mock(() => Promise.resolve({}))
const mockDelete = mock(() => Promise.resolve({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappApiKey: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

const { tokensRoutes } = await import("./tokens.route")

function createTestApp() {
  return new Elysia().use(tokensRoutes)
}

describe("tokens.route", () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    mockAuthContext.current = null
    mockFindMany.mockClear()
    mockFindUnique.mockClear()
    mockCreate.mockClear()
    mockUpdate.mockClear()
    mockDelete.mockClear()
    app = createTestApp()
  })

  describe("GET /tokens", () => {
    it("returns 401 when unauthorized", async () => {
      mockAuthContext.current = null

      const res = await app.handle(new Request("http://localhost/tokens"))

      expect(res.status).toBe(401)
    })

    it("returns organization tokens for tenant user", async () => {
      mockAuthContext.current = {
        type: "workos",
        organizationId: "org-1",
        userId: "user-1",
        platformRole: "member",
      }
      mockFindMany.mockResolvedValueOnce([
        { id: "tok-1", name: "Production Key", environment: "LIVE" },
      ] as unknown as never)

      const res = await app.handle(new Request("http://localhost/tokens"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        tokens: [{ id: "tok-1", name: "Production Key", environment: "LIVE" }],
      })
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { createdAt: "desc" },
      })
    })

    it("returns all tokens for super_admin", async () => {
      mockAuthContext.current = {
        type: "workos",
        userId: "user-super",
        platformRole: "super_admin",
      }
      mockFindMany.mockResolvedValueOnce([] as unknown as never)

      const res = await app.handle(new Request("http://localhost/tokens"))

      expect(res.status).toBe(200)
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
      })
    })
  })

  describe("GET /tokens/:id", () => {
    it("returns 404 when token not found", async () => {
      mockAuthContext.current = {
        type: "workos",
        organizationId: "org-1",
      }
      mockFindUnique.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/tokens/tok-404")
      )

      expect(res.status).toBe(404)
    })

    it("returns 403 when token belongs to another organization", async () => {
      mockAuthContext.current = {
        type: "workos",
        organizationId: "org-1",
        platformRole: "member",
      }
      mockFindUnique.mockResolvedValueOnce({
        id: "tok-other",
        organizationId: "org-other",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/tokens/tok-other")
      )

      expect(res.status).toBe(403)
    })

    it("returns token details when authorized", async () => {
      mockAuthContext.current = {
        type: "workos",
        organizationId: "org-1",
      }
      mockFindUnique.mockResolvedValueOnce({
        id: "tok-1",
        organizationId: "org-1",
        name: "My Token",
      } as unknown as never)

      const res = await app.handle(new Request("http://localhost/tokens/tok-1"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({
        ok: true,
        token: { id: "tok-1", organizationId: "org-1", name: "My Token" },
      })
    })
  })

  describe("POST /tokens", () => {
    it("creates a new token with organizationId from auth context", async () => {
      mockAuthContext.current = {
        type: "workos",
        organizationId: "org-1",
      }
      mockCreate.mockResolvedValueOnce({
        id: "tok-new",
        name: "New Key",
        key: "wa_live_secret",
        environment: "LIVE",
        organizationId: "org-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/tokens", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "New Key",
            key: "wa_live_secret",
            environment: "LIVE",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          name: "New Key",
          key: "wa_live_secret",
          environment: "LIVE",
          organizationId: "org-1",
        },
      })
    })
  })

  describe("PATCH /tokens/:id", () => {
    it("updates existing token when authorized", async () => {
      mockAuthContext.current = {
        type: "workos",
        organizationId: "org-1",
      }
      mockFindUnique.mockResolvedValueOnce({
        id: "tok-1",
        organizationId: "org-1",
      } as unknown as never)
      mockUpdate.mockResolvedValueOnce({
        id: "tok-1",
        name: "Updated Name",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/tokens/tok-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Updated Name",
          }),
        })
      )

      expect(res.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "tok-1" },
        data: { name: "Updated Name" },
      })
    })
  })

  describe("DELETE /tokens/:id", () => {
    it("deletes token when authorized", async () => {
      mockAuthContext.current = {
        type: "workos",
        organizationId: "org-1",
      }
      mockFindUnique.mockResolvedValueOnce({
        id: "tok-1",
        organizationId: "org-1",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/tokens/tok-1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toEqual({ ok: true, message: "Token deleted." })
      expect(mockDelete).toHaveBeenCalledWith({
        where: { id: "tok-1" },
      })
    })
  })
})
