import { AppCredentialType, AppCredentialStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  encrypt,
  decrypt,
  parseEncryptedField,
  serializeEncryptedField,
  getEncryptionKey,
} from "@/lib/encryption"
import {
  getCredentialTypeDef,
  buildMaskedPreview,
} from "./credential-type-registry"

// ─── Create ────────────────────────────────────────────────────────────────

export async function createCredential<T extends AppCredentialType>({
  organizationId,
  type,
  name,
  metadata,
  secrets,
}: {
  organizationId: string
  type: T
  name: string
  metadata: unknown
  secrets: unknown
}) {
  const def = getCredentialTypeDef(type)

  const parsedMetadata = def.metadataSchema.parse(metadata)
  const parsedSecrets = def.secretsSchema.parse(secrets)

  const encrypted = encrypt(JSON.stringify(parsedSecrets), getEncryptionKey())
  const maskedPreview = buildMaskedPreview(type, parsedSecrets)
  return prisma.appCredential.create({
    data: {
      organizationId,
      type,
      name: name.trim(),
      metadata: parsedMetadata,
      encryptedJSON: serializeEncryptedField(encrypted),
      maskedPreview,
    },
    select: {
      id: true,
      type: true,
      name: true,
      metadata: true,
      maskedPreview: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

// ─── List ─────────────────────────────────────────────────────────────────

export async function listCredentials(
  organizationId: string,
  type?: AppCredentialType
) {
  return prisma.appCredential.findMany({
    where: { organizationId, ...(type ? { type } : {}) },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      name: true,
      metadata: true,
      maskedPreview: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

// ─── Get decrypted secrets ────────────────────────────────────────────────

export async function getDecryptedSecrets(
  organizationId: string,
  credentialId: string
) {
  const row = await prisma.appCredential.findFirst({
    where: { id: credentialId, organizationId },
    select: { encryptedJSON: true },
  })
  if (!row) throw new Error("Credential not found")

  const parsed = parseEncryptedField(row.encryptedJSON)
  if (!parsed) throw new Error("Invalid encrypted payload")

  return JSON.parse(decrypt(parsed, getEncryptionKey()))
}

// ─── Update ────────────────────────────────────────────────────────────────

export async function updateCredential(
  organizationId: string,
  credentialId: string,
  patch: {
    name?: string
    metadata?: unknown
    secrets?: unknown
  }
) {
  const existing = await prisma.appCredential.findFirst({
    where: { id: credentialId, organizationId },
  })
  if (!existing) throw new Error("Credential not found")

  const def = getCredentialTypeDef(existing.type)
  const updateData: Prisma.AppCredentialUpdateInput = {}

  if (patch.name) updateData.name = patch.name.trim()
  if (patch.metadata) {
    updateData.metadata = def.metadataSchema.parse(patch.metadata)
  }
  if (patch.secrets) {
    const parsedSecrets = def.secretsSchema.parse(patch.secrets)
    const encrypted = encrypt(JSON.stringify(parsedSecrets), getEncryptionKey())
    updateData.encryptedJSON = serializeEncryptedField(encrypted)
    updateData.maskedPreview = buildMaskedPreview(existing.type, parsedSecrets)
  }

  return prisma.appCredential.update({
    where: { id: credentialId },
    data: updateData,
    select: {
      id: true,
      type: true,
      name: true,
      metadata: true,
      maskedPreview: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

// ─── Revoke ────────────────────────────────────────────────────────────────

export async function revokeCredential(
  organizationId: string,
  credentialId: string
) {
  return prisma.appCredential.updateMany({
    where: { id: credentialId, organizationId },
    data: { status: AppCredentialStatus.REVOKED },
  })
}

// ─── Delete ───────────────────────────────────────────────────────────────

export async function deleteCredential(
  organizationId: string,
  credentialId: string
) {
  return prisma.appCredential.deleteMany({
    where: { id: credentialId, organizationId },
  })
}

export async function getCredentialType(
  organizationId: string,
  credentialId: string
): Promise<AppCredentialType | null> {
  const row = await prisma.appCredential.findFirst({
    where: { id: credentialId, organizationId },
    select: { type: true },
  })
  return row?.type ?? null
}
