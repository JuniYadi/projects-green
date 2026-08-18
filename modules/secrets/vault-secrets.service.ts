import type { Prisma, PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { VaultClient, VaultSecretNotFoundError } from "@/lib/vault/vault-client"
import {
  logVaultSecretReveal,
  type VaultSecretRevealAudit,
} from "./secrets-audit.service"

export type VaultSecretReference = {
  key: string
  type: "secret_ref"
  environment: string
  vaultPath: string
  vaultKey: string
  version: number
  updatedAt: string
  scope?: "all" | "build" | "runtime"
  id?: string
}

export type VaultSecretWriteInput = {
  organizationId: string
  stackId: string
  environment: string
  secrets: Record<string, string>
}

export type VaultSecretMetadataInput = {
  organizationId: string
  stackId: string
  environment: string
}

export type VaultSecretRevealInput = {
  organizationId: string
  stackId: string
  environment: string
  key: string
  workosUserId: string
}

export type VaultSecretWriteResult = {
  environment: string
  vaultPath: string
  version: number
  updatedAt: string
  references: VaultSecretReference[]
}

export type VaultSecretMetadataResult = {
  environment: string
  vaultPath: string
  references: VaultSecretReference[]
}

export type VaultSecretRevealResult = {
  environment: string
  key: string
  value: string
  version: number
  vaultPath: string
}

export class VaultSecretsServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class VaultStackNotFoundError extends VaultSecretsServiceError {}

export class VaultSecretValidationError extends VaultSecretsServiceError {}

type StackRecord = {
  id: string
  organizationId: string
  envVarsJson: Prisma.JsonValue
}

type SecretsDatabase = Pick<PrismaClient, "applicationStack">
type VaultSecretStore = Pick<
  VaultClient,
  "writeKV" | "readKV" | "deleteKV" | "getKVMetadata" | "listKV"
>
type VaultSecretAuditLogger = (
  event: VaultSecretRevealAudit
) => Promise<void> | void

export type VaultSecretsServiceOptions = {
  db?: SecretsDatabase
  client?: VaultSecretStore
  auditLogger?: VaultSecretAuditLogger
  now?: () => Date
}

const ENVIRONMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const ENVIRONMENT_VARIABLE_PATTERN = /^[A-Z][A-Z0-9_]*$/

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const normalizeEnvironment = (environment: string): string => {
  const normalized = environment.trim()
  if (!ENVIRONMENT_PATTERN.test(normalized)) {
    throw new VaultSecretValidationError(
      "Environment must contain only letters, numbers, hyphens, and underscores."
    )
  }

  return normalized
}

const normalizeKey = (key: string): string => {
  const normalized = key.trim().toUpperCase()
  if (!ENVIRONMENT_VARIABLE_PATTERN.test(normalized)) {
    throw new VaultSecretValidationError(
      "Secret keys must match ^[A-Z][A-Z0-9_]*$."
    )
  }

  return normalized
}

const normalizeSecrets = (
  secrets: Record<string, string>
): Record<string, string> => {
  const normalized: Record<string, string> = {}

  for (const [key, value] of Object.entries(secrets)) {
    if (typeof value !== "string") {
      throw new VaultSecretValidationError("Secret values must be strings.")
    }

    normalized[normalizeKey(key)] = value
  }

  if (Object.keys(normalized).length === 0) {
    throw new VaultSecretValidationError("At least one secret is required.")
  }

  return normalized
}

const toStoredItems = (value: Prisma.JsonValue): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord) as Record<string, unknown>[]
}

const isSecretItem = (item: Record<string, unknown>): boolean => {
  return item.type === "secret" || item.type === "secret_ref"
}

const toReference = (input: {
  existing?: Record<string, unknown>
  key: string
  environment: string
  vaultPath: string
  version: number
  updatedAt: string
}): VaultSecretReference => {
  const existing = input.existing ?? {}
  const { value: _value, ...metadata } = existing

  return {
    ...metadata,
    key: input.key,
    type: "secret_ref",
    environment: input.environment,
    vaultPath: input.vaultPath,
    vaultKey: input.key,
    version: input.version,
    updatedAt: input.updatedAt,
  } as VaultSecretReference
}

const referencesForEnvironment = (
  items: Record<string, unknown>[],
  environment: string,
  vaultPath: string
): VaultSecretReference[] => {
  return items
    .filter(
      (item) =>
        item.type === "secret_ref" &&
        item.environment === environment &&
        item.vaultPath === vaultPath &&
        typeof item.key === "string" &&
        typeof item.vaultKey === "string" &&
        typeof item.version === "number" &&
        typeof item.updatedAt === "string"
    )
    .map((item) => item as unknown as VaultSecretReference)
}

const mergeSecretReferences = (input: {
  existing: Record<string, unknown>[]
  secrets: Record<string, string>
  environment: string
  vaultPath: string
  version: number
  updatedAt: string
}): Record<string, unknown>[] => {
  const next = [...input.existing]

  for (const key of Object.keys(input.secrets)) {
    const existingIndex = next.findIndex(
      (item) =>
        typeof item.key === "string" &&
        item.key.toUpperCase() === key &&
        (item.type !== "secret_ref" ||
          item.environment === input.environment ||
          item.environment === undefined)
    )

    const reference = toReference({
      existing: existingIndex >= 0 ? next[existingIndex] : undefined,
      key,
      environment: input.environment,
      vaultPath: input.vaultPath,
      version: input.version,
      updatedAt: input.updatedAt,
    })

    if (existingIndex >= 0) {
      next[existingIndex] = reference
    } else {
      next.push(reference)
    }
  }

  return next.map((item) => {
    if (!isSecretItem(item)) {
      return item
    }

    const { value: _value, ...metadata } = item
    return metadata
  })
}

export const buildVaultSecretPath = (input: {
  organizationId: string
  stackId: string
  environment: string
}): string => {
  const organizationId = input.organizationId.trim()
  const stackId = input.stackId.trim()
  const environment = normalizeEnvironment(input.environment)

  if (
    !organizationId ||
    !stackId ||
    organizationId.includes("/") ||
    stackId.includes("/")
  ) {
    throw new VaultSecretValidationError("Vault path identifiers are invalid.")
  }

  return `tenants/${organizationId}/stacks/${stackId}/${environment}/app-env`
}

export class VaultSecretsService {
  private readonly db: SecretsDatabase
  private readonly client: VaultSecretStore
  private readonly auditLogger: VaultSecretAuditLogger
  private readonly now: () => Date

  constructor(options: VaultSecretsServiceOptions = {}) {
    this.db = options.db ?? prisma
    this.client = options.client ?? new VaultClient()
    this.auditLogger = options.auditLogger ?? logVaultSecretReveal
    this.now = options.now ?? (() => new Date())
  }

  async writeSecrets(
    input: VaultSecretWriteInput
  ): Promise<VaultSecretWriteResult> {
    const environment = normalizeEnvironment(input.environment)
    const secrets = normalizeSecrets(input.secrets)
    const stack = await this.findStack(input.organizationId, input.stackId)
    const vaultPath = buildVaultSecretPath({
      organizationId: stack.organizationId,
      stackId: stack.id,
      environment,
    })
    const result = await this.client.writeKV(vaultPath, secrets)
    const updatedAt = this.now().toISOString()
    const nextItems = mergeSecretReferences({
      existing: toStoredItems(stack.envVarsJson),
      secrets,
      environment,
      vaultPath,
      version: result.version,
      updatedAt,
    })

    await this.db.applicationStack.update({
      where: { id: stack.id },
      data: { envVarsJson: nextItems as Prisma.InputJsonValue },
    })

    return {
      environment,
      vaultPath,
      version: result.version,
      updatedAt,
      references: referencesForEnvironment(nextItems, environment, vaultPath),
    }
  }

  async getSecretMetadata(
    input: VaultSecretMetadataInput
  ): Promise<VaultSecretMetadataResult> {
    const environment = normalizeEnvironment(input.environment)
    const stack = await this.findStack(input.organizationId, input.stackId)
    const vaultPath = buildVaultSecretPath({
      organizationId: stack.organizationId,
      stackId: stack.id,
      environment,
    })
    const items = toStoredItems(stack.envVarsJson)

    return {
      environment,
      vaultPath,
      references: referencesForEnvironment(items, environment, vaultPath),
    }
  }

  async revealSecret(
    input: VaultSecretRevealInput
  ): Promise<VaultSecretRevealResult> {
    const environment = normalizeEnvironment(input.environment)
    const key = normalizeKey(input.key)
    const stack = await this.findStack(input.organizationId, input.stackId)
    const vaultPath = buildVaultSecretPath({
      organizationId: stack.organizationId,
      stackId: stack.id,
      environment,
    })
    const reference = referencesForEnvironment(
      toStoredItems(stack.envVarsJson),
      environment,
      vaultPath
    ).find((item) => item.key === key)

    if (!reference) {
      throw new VaultSecretNotFoundError(`Secret ${key} was not found`)
    }

    const secrets = await this.client.readKV(vaultPath)
    const value = secrets[key]
    if (value === undefined) {
      throw new VaultSecretNotFoundError(`Secret ${key} was not found`)
    }

    try {
      await this.auditLogger({
        organizationId: stack.organizationId,
        stackId: stack.id,
        workosUserId: input.workosUserId,
        environment,
        secretKey: key,
      })
    } catch (error) {
      console.error("[VaultSecretAudit] Failed to log reveal:", error)
    }

    return {
      environment,
      key,
      value,
      version: reference.version,
      vaultPath,
    }
  }

  private async findStack(
    organizationId: string,
    stackId: string
  ): Promise<StackRecord> {
    const stack = await this.db.applicationStack.findFirst({
      where: { id: stackId, organizationId },
      select: { id: true, organizationId: true, envVarsJson: true },
    })

    if (!stack) {
      throw new VaultStackNotFoundError("Application stack not found")
    }

    return stack as StackRecord
  }
}
