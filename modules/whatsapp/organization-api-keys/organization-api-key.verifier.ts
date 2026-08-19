import type { PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getApiKeyHashSalt, hashApiKey } from "@/lib/whatsapp/crypto"

import {
  isWellFormedWhatsappOrganizationApiKey,
  WHATSAPP_ORGANIZATION_API_KEY_PREFIX,
} from "./organization-api-key.crypto"
export const WHATSAPP_API_KEY_LAST_USED_UPDATE_INTERVAL_MS = 60 * 60 * 1000

export type WhatsappOrganizationApiKeyAuthContext = {
  keyId: string
  organizationId: string
  fingerprint: string
}

export type WhatsappOrganizationApiKeyVerifyOptions = {
  clientIp?: string | null
  userAgent?: string | null
}

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
    const salt = getApiKeyHashSalt()
    const keyHash = await hashApiKey(
      rawKey.slice(WHATSAPP_ORGANIZATION_API_KEY_PREFIX.length),
      salt
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

    const normalizedClientIp = normalizeWhatsappOrganizationApiKeyClientIp(
      options.clientIp
    )

    // Authentication remains available if this best-effort usage telemetry fails.
    // Throttle updates to at most once per hour to prevent high request throughput from draining the DB.
    const lastUsedThreshold = new Date(
      Date.now() - WHATSAPP_API_KEY_LAST_USED_UPDATE_INTERVAL_MS
    )
    void database.whatsappOrganizationApiKey
      .updateMany({
        where: {
          id: key.id,
          status: "ACTIVE",
          OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: lastUsedThreshold } }],
        },
        data: {
          lastUsedAt: new Date(),
          lastUsedIp: normalizedClientIp,
          lastUsedUserAgent: options.userAgent ?? null,
        },
      })
      .catch(() => undefined)
    return {
      keyId: key.id,
      organizationId: key.organizationId,
      fingerprint: key.fingerprint,
    }
  } catch {
    return null
  }
}

export const normalizeWhatsappOrganizationApiKeyClientIp = (
  value: string | null | undefined
) => value?.split(",")[0]?.trim() || null
