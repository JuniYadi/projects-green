import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

const mockImportManagedStock = mock(async () => ({
  id: "stock-1",
  clusterId: "cluster-1",
  serviceType: "MYSQL" as const,
  label: "Primary",
  endpointHost: "mysql.internal",
  endpointPort: 3306,
  databaseName: "app",
  username: "app_user",
  tlsEnabled: true,
  vaultPath: "admin/managed-stock/stock-1",
  vaultVersion: 1,
  status: "AVAILABLE" as const,
  allocatedStackId: null,
  allocatedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}))

const mockListManagedStocks = mock(async () => [])
const mockUpdateManagedStockStatus = mock(async () => undefined)
const mockPrismaFindMany = mock(async () => [])
const mockPrismaCreate = mock(async () => ({}))
const mockPrismaUpdate = mock(async () => ({}))
const mockVaultWriteKV = mock(async () => ({ version: 1 }))
const mockVaultDeleteKV = mock(async () => undefined)

mock.module("@/modules/deploy/app-managed-stock.service", () => ({
  importManagedStock: mockImportManagedStock,
  listManagedStocks: mockListManagedStocks,
  updateManagedStockStatus: mockUpdateManagedStockStatus,
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    appManagedStock: {
      findMany: mockPrismaFindMany,
      create: mockPrismaCreate,
      update: mockPrismaUpdate,
    },
  },
}))

mock.module("@/lib/vault/vault-client", () => ({
  VaultClient: class {
    writeKV = mockVaultWriteKV
    deleteKV = mockVaultDeleteKV
  },
}))

const mockRequireSuperAdmin = mock(async () => ({
  ok: true as const,
  userId: "admin-1",
  platformRole: "super_admin" as const,
}))

mock.module("@/modules/admin/api/admin.guards", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}))

const { createManagedStockRoutes } =
  await import("@/modules/deploy/api/routes/app-managed-stock.route")

const BASE = "http://localhost/admin/managed-stocks"

const importBody = {
  clusterId: "cluster-1",
  serviceType: "MYSQL",
  label: "Primary",
  endpointHost: "mysql.internal",
  endpointPort: 3306,
  databaseName: "app",
  username: "app_user",
  password: "never-return-this",
  connectionUrl: "mysql://app_user:never-return-this@mysql.internal/app",
  tlsEnabled: true,
}

describe("managed stock admin routes", () => {
  beforeEach(() => {
    mockImportManagedStock.mockClear()
    mockListManagedStocks.mockClear()
    mockUpdateManagedStockStatus.mockClear()
    mockRequireSuperAdmin.mockClear()
    mockPrismaFindMany.mockClear()
    mockPrismaCreate.mockClear()
    mockPrismaUpdate.mockClear()
    mockVaultWriteKV.mockClear()
    mockVaultDeleteKV.mockClear()
    mockPrismaFindMany.mockImplementation(async () => [])
    mockPrismaCreate.mockImplementation(async () => ({}))
    mockPrismaUpdate.mockImplementation(async () => ({}))
    mockVaultWriteKV.mockImplementation(async () => ({ version: 1 }))
    mockVaultDeleteKV.mockImplementation(async () => undefined)
    mockImportManagedStock.mockImplementation(async () => ({
      id: "stock-1",
      clusterId: "cluster-1",
      serviceType: "MYSQL" as const,
      label: "Primary",
      endpointHost: "mysql.internal",
      endpointPort: 3306,
      databaseName: "app",
      username: "app_user",
      tlsEnabled: true,
      vaultPath: "admin/managed-stock/stock-1",
      vaultVersion: 1,
      status: "AVAILABLE" as const,
      allocatedStackId: null,
      allocatedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }))
    mockListManagedStocks.mockImplementation(async () => [])
    mockUpdateManagedStockStatus.mockImplementation(async () => undefined)
    mockRequireSuperAdmin.mockImplementation(async () => ({
      ok: true as const,
      userId: "admin-1",
      platformRole: "super_admin" as const,
    }))
  })

  it("imports stock and never returns the password", async () => {
    const app = new Elysia().use(createManagedStockRoutes())
    const response = await app.handle(
      new Request(`${BASE}/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(importBody),
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.id).toBe("stock-1")
    expect(body).not.toHaveProperty("password")
    expect(JSON.stringify(body)).not.toContain("never-return-this")
    expect(mockImportManagedStock).toHaveBeenCalledWith(importBody)
  })

  it("returns a list of managed stocks", async () => {
    mockListManagedStocks.mockResolvedValueOnce([
      {
        id: "stock-1",
        clusterId: "cluster-1",
        serviceType: "MYSQL",
        label: null,
        endpointHost: "mysql.internal",
        endpointPort: 3306,
        databaseName: "app",
        username: "app_user",
        tlsEnabled: false,
        vaultPath: "admin/managed-stock/stock-1",
        vaultVersion: 1,
        status: "AVAILABLE",
        allocatedStackId: null,
        allocatedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ] as never)

    const app = new Elysia().use(createManagedStockRoutes())
    const response = await app.handle(
      new Request(`${BASE}?clusterId=cluster-1`)
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe("stock-1")
    expect(mockListManagedStocks).toHaveBeenCalledWith("cluster-1")
  })

  it("returns 404 when the import cluster does not exist", async () => {
    mockImportManagedStock.mockRejectedValueOnce(new Error("CLUSTER_NOT_FOUND"))

    const app = new Elysia().use(createManagedStockRoutes())
    const response = await app.handle(
      new Request(`${BASE}/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...importBody, clusterId: "cluster-missing" }),
      })
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe("CLUSTER_NOT_FOUND")
  })

  it("marks a stock as maintenance instead of deleting it", async () => {
    const app = new Elysia().use(createManagedStockRoutes())
    const response = await app.handle(
      new Request(`${BASE}/stock-1`, { method: "DELETE" })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mockUpdateManagedStockStatus).toHaveBeenCalledWith(
      "stock-1",
      "MAINTENANCE"
    )
  })
})
