import { createId } from "@paralleldrive/cuid2"
import { Prisma } from "@prisma/client"
import type {
  AppManagedServiceType,
  AppManagedStock,
  AppManagedStockStatus,
} from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { VaultClient } from "@/lib/vault/vault-client"
import { VaultSecretsService } from "@/modules/secrets/vault-secrets.service"
import type { ImportManagedStockInput } from "@/modules/deploy/app-managed-stock.types"

type ClaimManagedStockInput = {
  serviceType: AppManagedServiceType
  stackId: string
  orgId: string
  environment: string
}

type StockCredentials = Record<string, string>

type StoredEnvironmentVariable = {
  type?: string
  vaultPath?: unknown
}

const getVault = () => new VaultClient()
const getVaultSecrets = () => new VaultSecretsService()

const buildConnectionUrl = (
  input: ImportManagedStockInput,
  host: string,
  databaseName: string,
  username: string
): string => {
  if (input.connectionUrl?.trim()) return input.connectionUrl.trim()

  switch (input.serviceType) {
    case "MYSQL":
      return (
        `mysql://${username}:${input.password}@${host}:` +
        `${input.endpointPort}/${databaseName}`
      )
    case "POSTGRESQL":
      return (
        `postgresql://${username}:${input.password}@${host}:` +
        `${input.endpointPort}/${databaseName}`
      )
    case "REDIS":
      return `redis://:${input.password}@${host}:${input.endpointPort}`
  }
}

const validateImportInput = (input: ImportManagedStockInput): void => {
  if (!input.endpointHost?.trim()) {
    throw new Error("endpointHost is required")
  }
  if (
    !Number.isInteger(input.endpointPort) ||
    input.endpointPort < 1 ||
    input.endpointPort > 65535
  ) {
    throw new Error("endpointPort must be a valid port (1-65535)")
  }
  if (!input.databaseName?.trim()) {
    throw new Error("databaseName is required")
  }
  if (!input.username?.trim()) {
    throw new Error("username is required")
  }
  if (!input.password?.trim()) {
    throw new Error("password is required")
  }
}

export async function importManagedStock(
  input: ImportManagedStockInput
): Promise<AppManagedStock> {
  validateImportInput(input)

  const cluster = await prisma.appHostingCluster.findUnique({
    where: { id: input.clusterId },
  })
  if (!cluster) throw new Error("CLUSTER_NOT_FOUND")

  const stockId = createId()
  const endpointHost = input.endpointHost.trim()
  const databaseName = input.databaseName.trim()
  const username = input.username.trim()
  const vaultPath = `admin/managed-stock/${stockId}`
  const connectionUrl = buildConnectionUrl(
    input,
    endpointHost,
    databaseName,
    username
  )
  const writeResult = await getVault().writeKV(vaultPath, {
    password: input.password,
    connectionUrl,
  })

  return prisma.appManagedStock.create({
    data: {
      id: stockId,
      clusterId: input.clusterId,
      serviceType: input.serviceType,
      label: input.label?.trim() || null,
      endpointHost,
      endpointPort: input.endpointPort,
      databaseName,
      username,
      tlsEnabled: input.tlsEnabled ?? false,
      vaultPath,
      vaultVersion: writeResult.version,
      status: "AVAILABLE",
    },
  })
}

export async function listManagedStocks(
  clusterId?: string
): Promise<AppManagedStock[]> {
  return prisma.appManagedStock.findMany({
    ...(clusterId ? { where: { clusterId } } : {}),
    orderBy: { createdAt: "desc" },
  })
}

const buildDbEnvVars = (
  serviceType: AppManagedServiceType,
  stock: AppManagedStock,
  credentials: StockCredentials
): Record<string, string> => {
  const password = credentials.password
  if (!password) throw new Error("STOCK_CREDENTIALS_MISSING")

  switch (serviceType) {
    case "MYSQL":
      return {
        DB_TYPE: "mysqldb",
        DB_MYSQLDB_HOST: stock.endpointHost,
        DB_MYSQLDB_PORT: String(stock.endpointPort),
        DB_MYSQLDB_DATABASE: stock.databaseName,
        DB_MYSQLDB_USER: stock.username,
        DB_MYSQLDB_PASSWORD: password,
      }
    case "POSTGRESQL":
      return {
        DB_TYPE: "postgresdb",
        DB_POSTGRESDB_HOST: stock.endpointHost,
        DB_POSTGRESDB_PORT: String(stock.endpointPort),
        DB_POSTGRESDB_DATABASE: stock.databaseName,
        DB_POSTGRESDB_USER: stock.username,
        DB_POSTGRESDB_PASSWORD: password,
      }
    case "REDIS":
      return {
        REDIS_HOST: stock.endpointHost,
        REDIS_PORT: String(stock.endpointPort),
        REDIS_PASSWORD: password,
      }
  }
}

export async function claimManagedStock(
  input: ClaimManagedStockInput
): Promise<AppManagedStock> {
  const stock = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<AppManagedStock[]>(
      Prisma.sql`
        SELECT *
        FROM "AppManagedStock"
        WHERE "serviceType" = ${input.serviceType}::"AppManagedServiceType"
          AND "status" = 'AVAILABLE'::"AppManagedStockStatus"
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `
    )
    const available = rows[0]
    if (!available) throw new Error("STOCK_NOT_AVAILABLE")

    return tx.appManagedStock.update({
      where: { id: available.id },
      data: {
        status: "ALLOCATED",
        allocatedStackId: input.stackId,
        allocatedAt: new Date(),
      },
    })
  })

  try {
    const credentials = await getVault().readKV(stock.vaultPath)
    const dbEnvVars = buildDbEnvVars(input.serviceType, stock, credentials)
    await getVaultSecrets().writeSecrets({
      organizationId: input.orgId,
      stackId: input.stackId,
      environment: input.environment,
      secrets: dbEnvVars,
    })
  } catch (error) {
    await prisma.appManagedStock
      .update({
        where: { id: stock.id },
        data: {
          status: "DIRTY",
          allocatedStackId: null,
          allocatedAt: null,
        },
      })
      .catch(() => {})
    throw error
  }
  return stock
}
const findTenantVaultPath = (envVarsJson: unknown): string | null => {
  if (!Array.isArray(envVarsJson)) return null

  const entry = envVarsJson.find((item): item is StoredEnvironmentVariable => {
    if (typeof item !== "object" || item === null) return false
    const variable = item as StoredEnvironmentVariable
    return (
      variable.type === "secret_ref" && typeof variable.vaultPath === "string"
    )
  })

  return typeof entry?.vaultPath === "string" ? entry.vaultPath : null
}

export async function releaseManagedStock(stackId: string): Promise<void> {
  const stock = await prisma.appManagedStock.findUnique({
    where: { allocatedStackId: stackId },
  })
  if (!stock) return

  const stack = await prisma.applicationStack.findUnique({
    where: { id: stackId },
    select: { envVarsJson: true },
  })
  const tenantVaultPath = findTenantVaultPath(stack?.envVarsJson)

  await prisma.appManagedStock.update({
    where: { id: stock.id },
    data: {
      status: "DIRTY",
      allocatedStackId: null,
      allocatedAt: null,
    },
  })

  if (tenantVaultPath) await getVault().deleteKV(tenantVaultPath)
}

export async function updateManagedStockStatus(
  id: string,
  status: AppManagedStockStatus
): Promise<AppManagedStock> {
  return prisma.appManagedStock.update({
    where: { id },
    data: { status },
  })
}
