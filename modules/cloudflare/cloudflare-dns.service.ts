import { createHash } from "node:crypto"

import type { CloudflareDnsCredential } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  decrypt,
  encrypt,
  parseEncryptedField,
  serializeEncryptedField,
} from "@/lib/encryption"

const getRequiredEnv = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const getEncryptionKey = () => {
  return createHash("sha256").update(getRequiredEnv("APP_SECRET")).digest()
}

export type CloudflareDnsCredentialListItem = Pick<
  CloudflareDnsCredential,
  "id" | "name" | "createdAt" | "updatedAt"
> & {
  maskedToken: string
}

function buildMaskedToken(tokenJson: string): string {
  const parsed = parseEncryptedField(tokenJson)
  if (!parsed) return "cf???…"
  try {
    const key = getEncryptionKey()
    const plaintext = decrypt(parsed, key)
    const last4 = plaintext.slice(-4)
    return `cf…${last4}`
  } catch {
    return "cf???…"
  }
}

export async function listCredentials(organizationId: string): Promise<CloudflareDnsCredentialListItem[]> {
  const rows = await prisma.cloudflareDnsCredential.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  })
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    maskedToken: buildMaskedToken(row.tokenJson),
  }))
}

export async function upsertCredential({
  organizationId,
  name,
  token,
}: {
  organizationId: string
  name: string
  token: string
}): Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date; maskedToken: string }> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error("Credential name cannot be empty")

  const key = getEncryptionKey()
  const encrypted = encrypt(token, key)
  const tokenJson = serializeEncryptedField(encrypted)

  const row = await prisma.cloudflareDnsCredential.upsert({
    where: {
      organizationId_name: { organizationId, name: trimmedName },
    },
    update: { tokenJson },
    create: { organizationId, name: trimmedName, tokenJson },
  })

  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    maskedToken: buildMaskedToken(row.tokenJson),
  }
}

export async function deleteCredential({
  organizationId,
  id,
}: {
  organizationId: string
  id: string
}): Promise<void> {
  await prisma.cloudflareDnsCredential.deleteMany({
    where: { id, organizationId },
  })
}
