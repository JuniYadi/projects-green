import type {
  AppManagedServiceCredential,
  AppManagedServiceType,
} from "@prisma/client"

import {
  decrypt,
  deriveEncryptionKey,
  encrypt,
  parseEncryptedField,
  serializeEncryptedField,
} from "@/lib/encryption"
import { prisma } from "@/lib/prisma"
import type {
  AppManagedServiceCredentialUpsertInput,
  AppManagedServiceCredentialStatusUpdateInput,
  AppManagedServiceInternalConfig,
} from "@/modules/deploy/app-managed-service.types"

const MANAGED_SERVICE_KEY_SALT = "app-managed-service-credential"
const MANAGED_SERVICE_KEY_INFO_PREFIX = "app-managed-service-v"

function getManagedServiceEncryptionKey(keyVersion = 1): Buffer {
  const secret = process.env.ENCRYPTION_KEY
  if (!secret) throw new Error("Missing ENCRYPTION_KEY env var")
  return deriveEncryptionKey({
    secret,
    salt: MANAGED_SERVICE_KEY_SALT,
    info: `${MANAGED_SERVICE_KEY_INFO_PREFIX}${keyVersion}`,
  })
}

function validateManagedServiceInput(
  serviceType: AppManagedServiceType,
  input: AppManagedServiceCredentialUpsertInput
) {
  if (!input.endpointHost || input.endpointHost.trim().length === 0) {
    throw new Error("endpointHost is required")
  }
  if (
    !Number.isInteger(input.endpointPort) ||
    input.endpointPort < 1 ||
    input.endpointPort > 65535
  ) {
    throw new Error("endpointPort must be a valid port (1-65535)")
  }
  if (serviceType === "MYSQL" || serviceType === "POSTGRESQL") {
    if (!input.username || input.username.trim().length === 0) {
      throw new Error("username is required for MySQL/PostgreSQL")
    }
    if (!input.password || input.password.trim().length === 0) {
      throw new Error("password is required for MySQL/PostgreSQL")
    }
  }
  if (serviceType === "REDIS") {
    if (!input.authToken || input.authToken.trim().length === 0) {
      throw new Error("authToken is required for Redis")
    }
  }
}

function maskCredential(
  serviceType: AppManagedServiceType,
  input: AppManagedServiceCredentialUpsertInput
): string | null {
  if (serviceType === "MYSQL" || serviceType === "POSTGRESQL") {
    const pw = input.password ?? ""
    if (pw.length === 0) return null
    if (pw.length <= 4) return `${pw.slice(0, 1)}…`
    return `${pw.slice(0, 2)}…${pw.slice(-2)}`
  }
  if (serviceType === "REDIS") {
    const token = input.authToken ?? ""
    if (token.length === 0) return null
    if (token.length <= 4) return `${token.slice(0, 1)}…`
    return `${token.slice(0, 2)}…${token.slice(-2)}`
  }
  return null
}

function encryptCredential(
  serviceType: AppManagedServiceType,
  input: AppManagedServiceCredentialUpsertInput,
  keyVersion: number
): string | null {
  const payload: Record<string, string> = {}
  if (serviceType === "MYSQL" || serviceType === "POSTGRESQL") {
    payload.password = input.password ?? ""
  }
  if (serviceType === "REDIS") {
    payload.authToken = input.authToken ?? ""
  }
  if (Object.keys(payload).length === 0) return null
  const plaintext = JSON.stringify(payload)
  const encrypted = encrypt(
    plaintext,
    getManagedServiceEncryptionKey(keyVersion)
  )
  return serializeEncryptedField(encrypted)
}

function decryptCredential(
  ciphertext: string | null,
  keyVersion = 1
): Record<string, string> | null {
  if (!ciphertext) return null
  const parsed = parseEncryptedField(ciphertext)
  if (!parsed) return null
  const plaintext = decrypt(parsed, getManagedServiceEncryptionKey(keyVersion))
  try {
    return JSON.parse(plaintext) as Record<string, string>
  } catch {
    return null
  }
}

export async function upsertAppManagedServiceCredential(
  clusterId: string,
  serviceType: AppManagedServiceType,
  input: AppManagedServiceCredentialUpsertInput
): Promise<AppManagedServiceCredential> {
  validateManagedServiceInput(serviceType, input)

  const cluster = await prisma.appHostingCluster.findUnique({
    where: { id: clusterId },
  })
  if (!cluster) {
    const err = new Error(
      `NOT_FOUND: Cluster ${clusterId} not found`
    ) as Error & { code: string }
    err.code = "NOT_FOUND"
    throw err
  }

  const existing = await prisma.appManagedServiceCredential.findUnique({
    where: { clusterId_serviceType: { clusterId, serviceType } },
  })
  const keyVersion = existing ? existing.keyVersion : 1

  const secretCiphertext = encryptCredential(serviceType, input, keyVersion)
  const secretPreview = maskCredential(serviceType, input)

  const row = await prisma.appManagedServiceCredential.upsert({
    where: { clusterId_serviceType: { clusterId, serviceType } },
    create: {
      clusterId,
      serviceType,
      endpointHost: input.endpointHost.trim(),
      endpointPort: input.endpointPort,
      tlsEnabled: input.tlsEnabled ?? false,
      username: input.username?.trim() ?? null,
      secretCiphertext,
      secretPreview,
      isActive: input.isActive ?? true,
      keyVersion,
    },
    update: {
      endpointHost: input.endpointHost.trim(),
      endpointPort: input.endpointPort,
      tlsEnabled: input.tlsEnabled ?? false,
      username: input.username?.trim() ?? null,
      secretCiphertext,
      secretPreview,
      keyVersion,
    },
  })

  return row
}

export async function updateAppManagedServiceCredentialStatus(
  id: string,
  input: AppManagedServiceCredentialStatusUpdateInput
): Promise<AppManagedServiceCredential> {
  const row = await prisma.appManagedServiceCredential.update({
    where: { id },
    data: { isActive: input.isActive },
  })
  return row
}

export async function resolveAppManagedServiceCredential(
  clusterId: string,
  serviceType: AppManagedServiceType
): Promise<AppManagedServiceInternalConfig> {
  const row = await prisma.appManagedServiceCredential.findUnique({
    where: { clusterId_serviceType: { clusterId, serviceType } },
  })
  if (!row) {
    const err = new Error(
      `NOT_FOUND: Managed service credential for ${clusterId}/${serviceType} not found`
    ) as Error & { code: string }
    err.code = "NOT_FOUND"
    throw err
  }
  if (!row.isActive) {
    const err = new Error(
      `INACTIVE: Managed service credential for ${clusterId}/${serviceType} is inactive`
    ) as Error & { code: string }
    err.code = "INACTIVE"
    throw err
  }

  const decrypted = decryptCredential(row.secretCiphertext, row.keyVersion)
  const password =
    serviceType === "MYSQL" || serviceType === "POSTGRESQL"
      ? (decrypted?.password ?? null)
      : null
  const authToken =
    serviceType === "REDIS" ? (decrypted?.authToken ?? null) : null

  return {
    serviceType,
    endpointHost: row.endpointHost,
    endpointPort: row.endpointPort,
    tlsEnabled: row.tlsEnabled,
    username: row.username,
    password,
    authToken,
  }
}
