import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import {
  setMockAuthContext,
  mockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "../../../../test/workos-node-mock"

const mockFindFirst = mock(async (): Promise<any> => null)
const mockFindMany = mock(async (): Promise<any[]> => [])
const mockCreate = mock(async (args: any) => ({
  id: "cat_1",
  organizationId: "org_1",
  name: args.data.name,
  metaCatalogId: args.data.metaCatalogId,
  deviceId: args.data.deviceId ?? null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { products: 0 },
}))
const mockUpdate = mock(async (args: any) => ({
  id: "cat_1",
  organizationId: "org_1",
  name: args.data.name ?? "My Store",
  metaCatalogId: args.data.metaCatalogId ?? "meta_cat_1",
  deviceId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { products: 0 },
}))
const mockDelete = mock(async () => ({ id: "cat_1" }))
const mockLogAudit = mock(async () => {})

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappCatalog: {
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
    whatsappCatalogProduct: {
      findMany: mock(async () => []),
    },
    whatsappDevice: {
      findFirst: mock(async () => null),
    },
  },
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mock(async () => ({
    user: { id: "user_1", email: "admin@example.com" },
    organizationId: "org_1",
  })),
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => "none"),
}))

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogAudit,
}))

const { catalogsRoutes } = await import("./catalogs.route")

function createTestApp() {
  return new Elysia().use(catalogsRoutes)
}

describe("catalogs routes", () => {
  beforeEach(() => {
    setMockAuthContext({ organizationId: "org_1", userId: "user_1", orgRole: "admin" })
    mockCreate.mockClear()
    mockFindFirst.mockClear()
    mockFindMany.mockClear()
    mockUpdate.mockClear()
    mockDelete.mockClear()
    mockLogAudit.mockClear()
  })

  afterEach(() => {
    setMockAuthContext(null)
  })

  describe("GET /", () => {
    it("returns 401 without auth", async () => {
      setMockAuthContext(null)
      const app = createTestApp()
      const res = await app.handle(new Request("http://localhost/catalogs"))
      expect(res.status).toBe(401)
    })

    it("lists catalogs", async () => {
      mockFindMany.mockImplementationOnce(async () => [
        { id: "cat_1", organizationId: "org_1", name: "Test", metaCatalogId: "m1", deviceId: null, createdAt: new Date(), updatedAt: new Date(), _count: { products: 3 } },
      ])
      const app = createTestApp()
      const res = await app.handle(new Request("http://localhost/catalogs"))
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toHaveLength(1)
    })
  })

  describe("POST /", () => {
    it("creates a catalog", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/catalogs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "My Catalog", metaCatalogId: "meta_123" }),
        })
      )
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data.name).toBe("My Catalog")
    })

    it("rejects missing name", async () => {
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/catalogs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ metaCatalogId: "meta_123" }),
        })
      )
      expect(res.status).toBe(422)
    })
  })

  describe("GET /:catalogId/products", () => {
    it("returns products for a catalog", async () => {
      mockFindFirst.mockImplementationOnce(async () => ({
        id: "cat_1", organizationId: "org_1",
      }))
      const app = createTestApp()
      const res = await app.handle(new Request("http://localhost/catalogs/cat_1/products"))
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.data).toEqual([])
    })

    it("returns 404 if catalog not found", async () => {
      const app = createTestApp()
      const res = await app.handle(new Request("http://localhost/catalogs/nonexistent/products"))
      expect(res.status).toBe(404)
    })
  })

  describe("DELETE /:id", () => {
    it("deletes a catalog", async () => {
      mockFindFirst.mockImplementationOnce(async () => ({
        id: "cat_1", organizationId: "org_1",
      }))
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/catalogs/cat_1", { method: "DELETE" })
      )
      const body = await res.json()
      expect(body.ok).toBe(true)
    })
  })
})
