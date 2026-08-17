import type { PrismaClient, WhatsappOrganizationApiKey } from "@prisma/client"

import { listCachedOrganizations } from "@/lib/workos-directory"
import { prisma } from "@/lib/prisma"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"

import {
  fingerprintWhatsappOrganizationApiKey,
  generateWhatsappOrganizationApiKey,
} from "./organization-api-key.crypto"
import {
  toWhatsappOrganizationApiKeyDTO,
  type WhatsappOrganizationApiKeyDTO,
  type WhatsappOrganizationApiKeyInventoryDTO,
  type WhatsappOrganizationApiKeySelfDTO,
} from "./organization-api-keys.dto"
import type { InventoryQuery } from "./organization-api-keys.schemas"

type OrganizationDirectory = typeof listCachedOrganizations

export class WhatsappOrganizationApiKeyAlreadyActiveError extends Error {
  readonly code = "WHATSAPP_ORGANIZATION_API_KEY_ALREADY_ACTIVE"

  constructor() {
    super("An active WhatsApp organization API key already exists.")
    this.name = "WhatsappOrganizationApiKeyAlreadyActiveError"
  }
}

export class WhatsappOrganizationApiKeyNotFoundError extends Error {
  readonly code = "WHATSAPP_ORGANIZATION_API_KEY_NOT_FOUND"

  constructor() {
    super("No active WhatsApp organization API key was found.")
    this.name = "WhatsappOrganizationApiKeyNotFoundError"
  }
}

const isUniqueConflict = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002"

type KeyRecord = Pick<
  WhatsappOrganizationApiKey,
  | "id"
  | "organizationId"
  | "fingerprint"
  | "status"
  | "createdAt"
  | "rotatedAt"
  | "revokedAt"
  | "lastUsedAt"
>

const publicKeySelect = {
  id: true,
  organizationId: true,
  fingerprint: true,
  status: true,
  createdAt: true,
  rotatedAt: true,
  revokedAt: true,
  lastUsedAt: true,
} as const

type OrganizationEntry = {
  id: string
  name: string | null
}

export class WhatsappOrganizationApiKeysService {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly organizationDirectory: OrganizationDirectory = listCachedOrganizations,
    private readonly now: () => Date = () => new Date()
  ) {}

  async generate(params: {
    organizationId: string
    actorId: string
  }): Promise<{ key: WhatsappOrganizationApiKeyDTO; secret: string }> {
    const active = await this.database.whatsappOrganizationApiKey.findFirst({
      where: { organizationId: params.organizationId, status: "ACTIVE" },
      select: { id: true },
    })

    if (active) {
      throw new WhatsappOrganizationApiKeyAlreadyActiveError()
    }

    const generated = await generateWhatsappOrganizationApiKey()
    const createdAt = this.now()
    const record = await this.database.whatsappOrganizationApiKey
      .create({
        data: {
          organizationId: params.organizationId,
          fingerprint: fingerprintWhatsappOrganizationApiKey(generated.hash),
          keyHash: generated.hash,
          status: "ACTIVE",
          createdByWorkosUserId: params.actorId,
          createdAt,
          updatedAt: createdAt,
        },
        select: publicKeySelect,
      })
      .catch((error: unknown) => {
        if (isUniqueConflict(error)) {
          throw new WhatsappOrganizationApiKeyAlreadyActiveError()
        }
        throw error
      })

    await logWhatsappAuditEvent({
      action: "ORGANIZATION_API_KEY_GENERATED",
      status: "OK",
      organizationId: params.organizationId,
      adminId: params.actorId,
      message: "WhatsApp organization API key generated.",
      details: {
        keyId: record.id,
        fingerprint: record.fingerprint,
      },
    })

    return {
      key: toWhatsappOrganizationApiKeyDTO(record),
      secret: generated.raw,
    }
  }

  async rotate(params: { organizationId: string; actorId: string }): Promise<{
    previousKey: WhatsappOrganizationApiKeyDTO
    key: WhatsappOrganizationApiKeyDTO
    secret: string
  }> {
    const rotatedAt = this.now()
    const generated = await generateWhatsappOrganizationApiKey()
    const fingerprint = fingerprintWhatsappOrganizationApiKey(generated.hash)

    const result = await this.database.$transaction(async (transaction) => {
      const active = await transaction.whatsappOrganizationApiKey.findFirst({
        where: { organizationId: params.organizationId, status: "ACTIVE" },
        select: publicKeySelect,
      })

      if (!active) {
        throw new WhatsappOrganizationApiKeyNotFoundError()
      }

      const previous = await transaction.whatsappOrganizationApiKey.update({
        where: { id: active.id },
        data: {
          status: "REVOKED",
          rotatedAt,
          revokedAt: rotatedAt,
          rotatedByWorkosUserId: params.actorId,
          revokedByWorkosUserId: params.actorId,
          updatedAt: rotatedAt,
        },
        select: publicKeySelect,
      })

      const key = await transaction.whatsappOrganizationApiKey.create({
        data: {
          organizationId: params.organizationId,
          fingerprint,
          keyHash: generated.hash,
          status: "ACTIVE",
          createdByWorkosUserId: params.actorId,
          createdAt: rotatedAt,
          updatedAt: rotatedAt,
        },
        select: publicKeySelect,
      })

      return { previous, key }
    })

    await logWhatsappAuditEvent({
      action: "ORGANIZATION_API_KEY_ROTATED",
      status: "OK",
      organizationId: params.organizationId,
      adminId: params.actorId,
      message: "WhatsApp organization API key rotated.",
      details: {
        previousKeyId: result.previous.id,
        previousFingerprint: result.previous.fingerprint,
        keyId: result.key.id,
        fingerprint: result.key.fingerprint,
      },
    })

    return {
      previousKey: toWhatsappOrganizationApiKeyDTO(result.previous),
      key: toWhatsappOrganizationApiKeyDTO(result.key),
      secret: generated.raw,
    }
  }

  async revoke(params: {
    organizationId: string
    actorId: string
  }): Promise<WhatsappOrganizationApiKeyDTO> {
    const active = await this.database.whatsappOrganizationApiKey.findFirst({
      where: { organizationId: params.organizationId, status: "ACTIVE" },
      select: publicKeySelect,
    })

    if (!active) {
      throw new WhatsappOrganizationApiKeyNotFoundError()
    }

    const revokedAt = this.now()
    const revoked = await this.database.whatsappOrganizationApiKey.update({
      where: { id: active.id },
      data: {
        status: "REVOKED",
        revokedAt,
        revokedByWorkosUserId: params.actorId,
        updatedAt: revokedAt,
      },
      select: publicKeySelect,
    })

    await logWhatsappAuditEvent({
      action: "ORGANIZATION_API_KEY_REVOKED",
      status: "OK",
      organizationId: params.organizationId,
      adminId: params.actorId,
      message: "WhatsApp organization API key revoked.",
      details: {
        keyId: revoked.id,
        fingerprint: revoked.fingerprint,
      },
    })

    return toWhatsappOrganizationApiKeyDTO(revoked)
  }

  async getOrganizationKeyState(
    organizationId: string
  ): Promise<WhatsappOrganizationApiKeySelfDTO> {
    const keys = await this.database.whatsappOrganizationApiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: publicKeySelect,
    })
    const latest = keys.find((key) => key.status === "ACTIVE") ?? keys[0]

    return {
      status: latest?.status ?? "NOT_GENERATED",
      keyId: latest?.id ?? null,
      fingerprint: latest?.fingerprint ?? null,
      generatedKeyCount: keys.length,
      createdAt: latest?.createdAt.toISOString() ?? null,
      rotatedAt: latest?.rotatedAt?.toISOString() ?? null,
      revokedAt: latest?.revokedAt?.toISOString() ?? null,
      lastUsedAt: latest?.lastUsedAt?.toISOString() ?? null,
    }
  }

  async listInventory(
    query: InventoryQuery
  ): Promise<WhatsappOrganizationApiKeyInventoryDTO> {
    const [keys, directoryOrganizations] = await Promise.all([
      this.database.whatsappOrganizationApiKey.findMany({
        orderBy: [{ organizationId: "asc" }, { createdAt: "desc" }],
        select: publicKeySelect,
      }),
      this.organizationDirectory(),
    ])

    const organizations = new Map<string, OrganizationEntry>()
    for (const organization of directoryOrganizations) {
      organizations.set(organization.id, {
        id: organization.id,
        name: organization.name,
      })
    }
    for (const key of keys) {
      if (!organizations.has(key.organizationId)) {
        organizations.set(key.organizationId, {
          id: key.organizationId,
          name: null,
        })
      }
    }

    const keysByOrganization = new Map<string, KeyRecord[]>()
    for (const key of keys) {
      const existing = keysByOrganization.get(key.organizationId) ?? []
      existing.push(key)
      keysByOrganization.set(key.organizationId, existing)
    }

    const activeOrganizationIds = new Set(
      keys
        .filter((key) => key.status === "ACTIVE")
        .map((key) => key.organizationId)
    )

    const rows = [...organizations.values()]
      .map((organization) => {
        const organizationKeys = keysByOrganization.get(organization.id) ?? []
        const latest =
          organizationKeys.find((key) => key.status === "ACTIVE") ??
          organizationKeys[0]
        const status = latest?.status ?? "NOT_GENERATED"

        return {
          organizationId: organization.id,
          organizationName: organization.name ?? organization.id,
          status,
          keyId: latest?.id ?? null,
          fingerprint: latest?.fingerprint ?? null,
          generatedKeyCount: organizationKeys.length,
          createdAt: latest?.createdAt.toISOString() ?? null,
          rotatedAt: latest?.rotatedAt?.toISOString() ?? null,
          revokedAt: latest?.revokedAt?.toISOString() ?? null,
          lastUsedAt: latest?.lastUsedAt?.toISOString() ?? null,
        }
      })
      .filter((row) => {
        if (query.status && row.status !== query.status) return false
        if (!query.q) return true
        const search = query.q.toLowerCase()
        return (
          row.organizationId.toLowerCase().includes(search) ||
          row.organizationName.toLowerCase().includes(search) ||
          row.fingerprint?.toLowerCase().includes(search)
        )
      })
      .sort((left, right) =>
        left.organizationName.localeCompare(right.organizationName)
      )

    const offset = (query.page - 1) * query.limit

    return {
      data: rows.slice(offset, offset + query.limit),
      summary: {
        generatedKeyTotal: keys.length,
        organizationsWithActiveKey: activeOrganizationIds.size,
        organizationsWithoutActiveKey:
          organizations.size - activeOrganizationIds.size,
      },
      pagination: {
        page: query.page,
        limit: query.limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / query.limit),
      },
    }
  }
}

export const whatsappOrganizationApiKeysService =
  new WhatsappOrganizationApiKeysService()
