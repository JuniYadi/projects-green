import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockWriteKV = mock(async () => ({ version: 3 }))
const mockReadKV = mock(async () => ({
  password: "db-secret",
  connectionUrl: "mysql://db",
}))
const mockDeleteKV = mock(async () => undefined)
const mockWriteSecrets = mock(async () => ({
  environment: "prod",
  vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
  version: 4,
  updatedAt: "2026-08-24T00:00:00.000Z",
  references: [],
}))

const mockPrisma = {
  appHostingCluster: {
    findUnique: mock(async () => ({ id: "cluster-1" })),
  },
  appManagedStock: {
    create: mock(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      label: data.label ?? null,
      allocatedStackId: null,
      allocatedAt: null,
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
    })),
    findMany: mock(async () => []),
    findUnique: mock(async () => null),
    update: mock(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "stock-1",
      clusterId: "cluster-1",
      serviceType: "MYSQL",
      label: null,
      endpointHost: "db.example.com",
      endpointPort: 3306,
      databaseName: "app",
      username: "app",
      tlsEnabled: false,
      vaultPath: "admin/managed-stock/stock-1",
      vaultVersion: 3,
      status: data.status ?? "AVAILABLE",
      allocatedStackId: data.allocatedStackId ?? null,
      allocatedAt: data.allocatedAt ?? null,
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
    })),
  },
  applicationStack: {
    findUnique: mock(async () => ({
      envVarsJson: [
        {
          key: "DB_MYSQLDB_PASSWORD",
          type: "secret_ref",
          vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        },
      ],
    })),
  },
  $transaction: mock(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      $queryRaw: mock(async () => [
        {
          id: "stock-1",
          clusterId: "cluster-1",
          serviceType: "MYSQL",
          label: null,
          endpointHost: "db.example.com",
          endpointPort: 3306,
          databaseName: "app",
          username: "app",
          tlsEnabled: false,
          vaultPath: "admin/managed-stock/stock-1",
          vaultVersion: 3,
          status: "AVAILABLE",
          allocatedStackId: null,
          allocatedAt: null,
          createdAt: new Date("2026-08-24T00:00:00.000Z"),
          updatedAt: new Date("2026-08-24T00:00:00.000Z"),
        },
      ]),
      appManagedStock: {
        update: mock(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "stock-1",
          clusterId: "cluster-1",
          serviceType: "MYSQL",
          label: null,
          endpointHost: "db.example.com",
          endpointPort: 3306,
          databaseName: "app",
          username: "app",
          tlsEnabled: false,
          vaultPath: "admin/managed-stock/stock-1",
          vaultVersion: 3,
          status: data.status,
          allocatedStackId: data.allocatedStackId,
          allocatedAt: data.allocatedAt,
          createdAt: new Date("2026-08-24T00:00:00.000Z"),
          updatedAt: new Date("2026-08-24T00:00:00.000Z"),
        })),
      },
    })
  ),
}

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
mock.module("@/lib/vault/vault-client", () => ({
  VaultClient: class {
    writeKV = mockWriteKV
    readKV = mockReadKV
    deleteKV = mockDeleteKV
  },
}))
mock.module("@/modules/secrets/vault-secrets.service", () => ({
  VaultSecretsService: class {
    writeSecrets = mockWriteSecrets
  },
}))

const { claimManagedStock, importManagedStock, releaseManagedStock } =
  await import("@/modules/deploy/app-managed-stock.service")

describe("managed stock service", () => {
  beforeEach(() => {
    mock.clearAllMocks()
    mockPrisma.appHostingCluster.findUnique.mockResolvedValue({
      id: "cluster-1",
    })
    mockPrisma.appManagedStock.create.mockResolvedValue({
      id: "stock-1",
      clusterId: "cluster-1",
      serviceType: "MYSQL",
      label: null,
      endpointHost: "db.example.com",
      endpointPort: 3306,
      databaseName: "app",
      username: "app",
      tlsEnabled: false,
      vaultPath: "admin/managed-stock/stock-1",
      vaultVersion: 3,
      status: "AVAILABLE",
      allocatedStackId: null,
      allocatedAt: null,
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
    })
    mockWriteKV.mockResolvedValue({ version: 3 })
    mockReadKV.mockResolvedValue({
      password: "db-secret",
      connectionUrl: "mysql://db",
    })
    mockWriteSecrets.mockResolvedValue({
      environment: "prod",
      vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
      version: 4,
      updatedAt: "2026-08-24T00:00:00.000Z",
      references: [],
    })
    mockPrisma.appManagedStock.findUnique.mockResolvedValue(null)
    mockPrisma.applicationStack.findUnique.mockResolvedValue({
      envVarsJson: [
        {
          key: "DB_MYSQLDB_PASSWORD",
          type: "secret_ref",
          vaultPath: "tenants/org-1/stacks/stack-1/prod/app-env",
        },
      ],
    })
  })

  it("imports stock and never sends password to Prisma", async () => {
    await importManagedStock({
      clusterId: "cluster-1",
      serviceType: "MYSQL",
      endpointHost: "db.example.com",
      endpointPort: 3306,
      databaseName: "app",
      username: "app",
      password: "db-secret",
    })

    expect(mockWriteKV).toHaveBeenCalledWith(
      expect.stringMatching(/^admin\/managed-stock\//),
      {
        password: "db-secret",
        connectionUrl: "mysql://app:db-secret@db.example.com:3306/app",
      }
    )
    const createData = mockPrisma.appManagedStock.create.mock.calls[0]?.[0]
      ?.data as Record<string, unknown>
    expect(createData).not.toHaveProperty("password")
    expect(createData).not.toHaveProperty("connectionUrl")
  })

  it("rejects empty password and host", async () => {
    await expect(
      importManagedStock({
        clusterId: "cluster-1",
        serviceType: "MYSQL",
        endpointHost: "db.example.com",
        endpointPort: 3306,
        databaseName: "app",
        username: "app",
        password: "",
      })
    ).rejects.toThrow("password")

    await expect(
      importManagedStock({
        clusterId: "cluster-1",
        serviceType: "MYSQL",
        endpointHost: " ",
        endpointPort: 3306,
        databaseName: "app",
        username: "app",
        password: "db-secret",
      })
    ).rejects.toThrow("endpointHost")
  })

  it("rejects a missing cluster", async () => {
    mockPrisma.appHostingCluster.findUnique.mockResolvedValueOnce(null)

    await expect(
      importManagedStock({
        clusterId: "missing",
        serviceType: "MYSQL",
        endpointHost: "db.example.com",
        endpointPort: 3306,
        databaseName: "app",
        username: "app",
        password: "db-secret",
      })
    ).rejects.toThrow("CLUSTER_NOT_FOUND")
  })

  it("claims MYSQL stock and writes tenant secret references", async () => {
    const result = await claimManagedStock({
      serviceType: "MYSQL",
      stackId: "stack-1",
      orgId: "org-1",
      environment: "prod",
    })

    expect(result.status).toBe("ALLOCATED")
    expect(mockReadKV).toHaveBeenCalledWith("admin/managed-stock/stock-1")
    expect(mockWriteSecrets).toHaveBeenCalledWith({
      organizationId: "org-1",
      stackId: "stack-1",
      environment: "prod",
      secrets: {
        DB_TYPE: "mysqldb",
        DB_MYSQLDB_HOST: "db.example.com",
        DB_MYSQLDB_PORT: "3306",
        DB_MYSQLDB_DATABASE: "app",
        DB_MYSQLDB_USER: "app",
        DB_MYSQLDB_PASSWORD: "db-secret",
      },
    })
  })

  it("marks allocated stock dirty when released", async () => {
    mockPrisma.appManagedStock.findUnique.mockResolvedValue({
      id: "stock-1",
      allocatedStackId: "stack-1",
      vaultPath: "admin/managed-stock/stock-1",
    })

    await releaseManagedStock("stack-1")

    expect(mockPrisma.appManagedStock.update).toHaveBeenCalledWith({
      where: { id: "stock-1" },
      data: {
        status: "DIRTY",
        allocatedStackId: null,
        allocatedAt: null,
      },
    })
  })
})
