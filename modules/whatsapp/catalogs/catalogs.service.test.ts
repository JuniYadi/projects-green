import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { catalogService } from "./catalogs.service"

const mockCatalog = (overrides: Record<string, unknown> = {}) => ({
  id: "cat_1",
  organizationId: "org_1",
  name: "My Store",
  metaCatalogId: "meta_cat_1",
  deviceId: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  _count: { products: 5 },
  ...overrides,
})

const mockProduct = (overrides: Record<string, unknown> = {}) => ({
  id: "prod_1",
  catalogId: "cat_1",
  productRetailerId: "SKU-001",
  name: "Test Product",
  description: "A test product",
  price: "10000",
  currency: "IDR",
  imageUrl: null,
  url: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
})

const mockCreate = mock(async (args: { data: Record<string, unknown>; include: any }) =>
  mockCatalog(args.data)
)
const mockFindFirst = mock(async () => mockCatalog())
const mockFindMany = mock(async () => [mockCatalog()])
const mockUpdate = mock(async (args: { where: any; data: any; include: any }) =>
  mockCatalog(args.data)
)
const mockDelete = mock(async () => mockCatalog())
const mockUpsert = mock(async (args: any) => mockProduct(args.create))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappCatalog: {
      create: mockCreate,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      update: mockUpdate,
      delete: mockDelete,
    },
    whatsappCatalogProduct: {
      findMany: mock(async () => [mockProduct()]),
      upsert: mockUpsert,
    },
  },
}))

describe("catalogService", () => {
  beforeEach(() => {
    mockCreate.mockClear()
    mockFindFirst.mockClear()
    mockFindMany.mockClear()
    mockUpdate.mockClear()
    mockDelete.mockClear()
    mockUpsert.mockClear()
  })

  describe("create", () => {
    it("creates a catalog", async () => {
      const result = await catalogService.create({
        organizationId: "org_1",
        name: "My Store",
        metaCatalogId: "meta_cat_1",
      })
      expect(result.name).toBe("My Store")
      expect(result.metaCatalogId).toBe("meta_cat_1")
    })
  })

  describe("findById", () => {
    it("finds a catalog by id and org", async () => {
      const result = await catalogService.findById("cat_1", "org_1")
      expect(result).toBeTruthy()
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "cat_1", organizationId: "org_1" } })
      )
    })
  })

  describe("list", () => {
    it("lists catalogs for an org ordered by creation date desc", async () => {
      const results = await catalogService.list("org_1")
      expect(results).toHaveLength(1)
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org_1" },
          orderBy: { createdAt: "desc" },
        })
      )
    })
  })

  describe("update", () => {
    it("updates a catalog", async () => {
      const result = await catalogService.update("cat_1", "org_1", { name: "Updated" })
      expect(result.name).toBe("Updated")
    })
  })

  describe("delete", () => {
    it("deletes a catalog if found", async () => {
      const result = await catalogService.delete("cat_1", "org_1")
      expect(result).toBeTruthy()
      expect(mockDelete).toHaveBeenCalled()
    })

    it("returns null if catalog not found", async () => {
      mockFindFirst.mockImplementationOnce(async () => null as any)
      const result = await catalogService.delete("cat_1", "org_1")
      expect(result).toBeNull()
      expect(mockDelete).not.toHaveBeenCalled()
    })
  })

  describe("listProducts", () => {
    it("lists products for a valid catalog", async () => {
      const result = await catalogService.listProducts("cat_1", "org_1")
      expect(result).toBeTruthy()
      expect(Array.isArray(result)).toBe(true)
    })

    it("returns null if catalog not found", async () => {
      mockFindFirst.mockImplementationOnce(async () => null as any)
      const result = await catalogService.listProducts("cat_1", "org_1")
      expect(result).toBeNull()
    })
  })

  describe("syncFromMeta", () => {
    it("returns null if catalog not found", async () => {
      mockFindFirst.mockImplementationOnce(async () => null as any)
      const result = await catalogService.syncFromMeta("cat_1", "org_1", "token")
      expect(result).toBeNull()
    })
  })
})
