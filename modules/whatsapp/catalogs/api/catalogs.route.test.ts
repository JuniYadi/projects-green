import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"
import { workosNodeMock } from "../../../../test/workos-node-mock"

const mockAuthContext = {
  current: null as {
    organizationId?: string
    type: string
    userId?: string
    orgRole?: string
  } | null,
}

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const mockResolveOrgRole = mock(async () => "admin")
mock.module("@/lib/auth/org-role", () => ({
  resolveOrgRole: mockResolveOrgRole,
}))

const mockList = mock(() => Promise.resolve([]))
const mockFindById = mock(() => Promise.resolve(null))
const mockCreate = mock(() => Promise.resolve({}))
const mockUpdate = mock(() => Promise.resolve({}))
const mockDelete = mock(() => Promise.resolve(true))
const mockListProducts = mock(() => Promise.resolve([]))
const mockSyncFromMeta = mock(() => Promise.resolve({ synced: 5 }))

mock.module("../catalogs.service", () => ({
  catalogService: {
    list: mockList,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    listProducts: mockListProducts,
    syncFromMeta: mockSyncFromMeta,
  },
}))

const mockCatalogFindFirst = mock(() => Promise.resolve(null))
const mockDeviceFindFirst = mock(() => Promise.resolve(null))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappCatalog: {
      findFirst: mockCatalogFindFirst,
    },
    whatsappDevice: {
      findFirst: mockDeviceFindFirst,
    },
  },
}))

const mockSendSingleProduct = mock(() =>
  Promise.resolve({ providerMessageId: "wamid.123" })
)
mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: class {
    sendSingleProduct = mockSendSingleProduct
  },
}))

mock.module("@/lib/whatsapp/crypto", () => ({
  decryptWhatsAppToken: async () => "decrypted_token",
}))

const mockLogWhatsappAuditEvent = mock(() => Promise.resolve())
mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogWhatsappAuditEvent,
}))

const sampleCatalog = {
  id: "cat-1",
  name: "Shoe Catalog",
  metaCatalogId: "meta-cat-1",
  organizationId: "org-1",
  deviceId: "dev-1",
  productCount: 10,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  device: { name: "Sales WA", tokenEncrypted: "enc_token" },
}

const { catalogsRoutes } = await import("./catalogs.route")

function createTestApp() {
  return new Elysia().use(catalogsRoutes)
}

describe("catalogs.route", () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    mockAuthContext.current = null
    mockList.mockClear()
    mockFindById.mockClear()
    mockCreate.mockClear()
    mockUpdate.mockClear()
    mockDelete.mockClear()
    mockListProducts.mockClear()
    mockSyncFromMeta.mockClear()
    mockCatalogFindFirst.mockClear()
    mockDeviceFindFirst.mockClear()
    mockSendSingleProduct.mockClear()
    mockLogWhatsappAuditEvent.mockClear()
    app = createTestApp()
  })

  describe("GET /catalogs", () => {
    it("returns 401 when unauthorized", async () => {
      const res = await app.handle(new Request("http://localhost/catalogs"))
      expect(res.status).toBe(401)
    })

    it("lists catalogs for organization", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockList.mockResolvedValueOnce([sampleCatalog] as unknown as never)

      const res = await app.handle(new Request("http://localhost/catalogs"))

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data).toHaveLength(1)
    })
  })

  describe("POST /catalogs", () => {
    it("creates a new catalog", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockCreate.mockResolvedValueOnce(sampleCatalog as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/catalogs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Shoe Catalog",
            metaCatalogId: "meta-cat-1",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.id).toBe("cat-1")
    })
  })

  describe("GET /catalogs/:id", () => {
    it("returns 404 when catalog not found", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockFindById.mockResolvedValueOnce(null)

      const res = await app.handle(
        new Request("http://localhost/catalogs/cat-404")
      )

      expect(res.status).toBe(404)
    })

    it("returns catalog when found", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockFindById.mockResolvedValueOnce(sampleCatalog as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/catalogs/cat-1")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.id).toBe("cat-1")
    })
  })

  describe("PATCH /catalogs/:id", () => {
    it("updates catalog", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockUpdate.mockResolvedValueOnce({
        ...sampleCatalog,
        name: "Updated Catalog",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/catalogs/cat-1", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Updated Catalog",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
    })
  })

  describe("DELETE /catalogs/:id", () => {
    it("deletes catalog", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockDelete.mockResolvedValueOnce(true as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/catalogs/cat-1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(mockDelete).toHaveBeenCalledWith("cat-1", "org-1")
    })
  })

  describe("GET /catalogs/:id/products", () => {
    it("lists products in catalog", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockListProducts.mockResolvedValueOnce([
        {
          id: "prod-1",
          retailerId: "RET-01",
          name: "Sneakers",
          price: "100.00",
          currency: "USD",
          availability: "in stock",
          catalogId: "cat-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/catalogs/cat-1/products")
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data).toHaveLength(1)
    })
  })

  describe("POST /catalogs/:id/sync", () => {
    it("syncs products from Meta", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockCatalogFindFirst.mockResolvedValueOnce(
        sampleCatalog as unknown as never
      )
      mockSyncFromMeta.mockResolvedValueOnce({
        synced: 15,
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/catalogs/cat-1/sync", {
          method: "POST",
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.synced).toBe(15)
    })
  })

  describe("POST /catalogs/send", () => {
    it("sends catalog message to recipient", async () => {
      mockAuthContext.current = {
        organizationId: "org-1",
        type: "workos",
        userId: "user-1",
        orgRole: "admin",
      }
      mockCatalogFindFirst.mockResolvedValueOnce(
        sampleCatalog as unknown as never
      )
      mockDeviceFindFirst.mockResolvedValueOnce({
        id: "dev-1",
        tokenEncrypted: "enc_token",
      } as unknown as never)

      const res = await app.handle(
        new Request("http://localhost/catalogs/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            to: "6281234567890",
            catalogId: "cat-1",
            type: "product",
            productRetailerId: "RET-01",
          }),
        })
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.data.providerMessageId).toBe("wamid.123")
    })
  })
})
