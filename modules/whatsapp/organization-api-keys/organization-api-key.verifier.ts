import type { PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { hashApiKey } from "@/lib/whatsapp/crypto"

import {
  isWellFormedWhatsappOrganizationApiKey,
  WHATSAPP_ORGANIZATION_API_KEY_PREFIX,
} from "./organization-api-key.crypto"

export type WhatsappOrganizationApiKeyAuthContext = {
  keyId: string
  organizationId: string
  fingerprint: string
}

export type WhatsappOrganizationApiKeyVerifyOptions = {
  clientIp?: string | null
  userAgent?: string | null
}

const API_KEY_HASH_SALT = () =>
  process.env.API_KEY_HASH_SALT?.trim() || "dev-salt-change-me"

export type WhatsappOrganizationApiKeyDatabase = Pick<
  PrismaClient,
  "whatsappOrganizationApiKey"
>

/**
 * Runtime-neutral verifier for the static WhatsApp organization credential.
 * It deliberately returns no failure reason so callers cannot enumerate keys.
 */
export async function verifyWhatsappOrganizationApiKey(
  rawKey: string | null | undefined,
  options: WhatsappOrganizationApiKeyVerifyOptions = {},
  database: WhatsappOrganizationApiKeyDatabase = prisma
): Promise<WhatsappOrganizationApiKeyAuthContext | null> {
  if (!rawKey || !isWellFormedWhatsappOrganizationApiKey(rawKey)) {
    return null
  }

  try {
    const keyHash = await hashApiKey(
      rawKey.slice(WHATSAPP_ORGANIZATION_API_KEY_PREFIX.length),
      API_KEY_HASH_SALT()
    )
    const key = await database.whatsappOrganizationApiKey.findFirst({
      where: { keyHash, status: "ACTIVE" },
      select: {
        id: true,
        organizationId: true,
        fingerprint: true,
      },
    })

    if (!key) return null

    const normalizedClientIp = options.clientIp?.split(",")[0]?.trim() || null

    database.whatsappOrganizationApiKey
      .updateMany({
        where: { id: key.id, status: "ACTIVE" },
        data: {
          lastUsedAt: new Date(),
          lastUsedIp: normalizedClientIp,
          lastUsedUserAgent: options.userAgent ?? null,
        },
      })
      .catch(() => {})

    return {
      keyId: key.id,
      organizationId: key.organizationId,
      fingerprint: key.fingerprint,
    }
  } catch {
    return null
  }
}
