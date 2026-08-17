import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PrismaClient, WhatsappOrganizationApiKey } from "@prisma/client"

const mockGenerateRawApiKey = mock(async () => ({
  raw: `wa_live_${"s".repeat(43)}`,
  hash: "one-way-hash",
}))
const mockAudit = mock(async () => {})

mock.module("@/lib/prisma", () => ({ prisma: {} }))
mock.module("@/lib/workos-directory", () => ({
  listCachedOrganizations: mock(async () => []),
}))
mock.module("@/lib/whatsapp/crypto", () => ({
  generateRawApiKey: mockGenerateRawApiKey,
}))
mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockAudit,
}))

const {
  WhatsappOrganizationApiKeyAlreadyActiveError,
  WhatsappOrganizationApiKeyNotFoundError,
  WhatsappOrganizationApiKeysService,
} = await import("./organization-api-keys.service")

const timestamp = new Date("2026-08-14T10:00:00.000Z")

const record = (
  overrides: Partial<WhatsappOrganizationApiKey> = {}
): WhatsappOrganizationApiKey => ({
  id: "key-1",
  organizationId: "org-1",
  fingerprint: "fingerprint-1",
  keyHash: "one-way-hash",
  status: "ACTIVE" as const,
  createdByWorkosUserId: "admin-1",
  rotatedByWorkosUserId: null,
  revokedByWorkosUserId: null,
  createdAt: timestamp,
  rotatedAt: null,
  revokedAt: null,
  lastUsedAt: null,
  lastUsedIp: null,
  lastUsedUserAgent: null,
  updatedAt: timestamp,
  ...overrides,
})

const createDatabase = () => {
  const findFirst = mock(
    async (): Promise<WhatsappOrganizationApiKey | null> => null
  )
  const findMany = mock(async (): Promise<WhatsappOrganizationApiKey[]> => [])
  const create = mock(async (): Promise<WhatsappOrganizationApiKey> => record())
  const update = mock(async (): Promise<WhatsappOrganizationApiKey> => record())
  const updateMany = mock(
    async (): Promise<{ count: number }> => ({
      count: 1,
    })
  )
  const database = {
    whatsappOrganizationApiKey: {
      findFirst,
      findMany,
      create,
      update,
      updateMany,
    },
    $transaction: mock(async (callback: (transaction: unknown) => unknown) =>
      callback(database)
    ),
  }

  return database
}

describe("WhatsappOrganizationApiKeysService", () => {
  beforeEach(() => {
    mockGenerateRawApiKey.mockClear()
    mockGenerateRawApiKey.mockImplementation(async () => ({
      raw: `wa_live_${"s".repeat(43)}`,
      hash: "one-way-hash",
    }))
    mockAudit.mockClear()
  })

  it("generates a redacted DTO and never persists the plaintext secret", async () => {
    const database = createDatabase()
    const created = record()
    database.whatsappOrganizationApiKey.create.mockResolvedValue(created)
    const service = new WhatsappOrganizationApiKeysService(
      database as unknown as PrismaClient,
      async () => [{ id: "org-1", name: "Org One", slug: "org-1" }],
      () => timestamp
    )

    const result = await service.generate({
      organizationId: "org-1",
      actorId: "admin-1",
    })

    expect(result.secret).toBe(`wa_live_${"s".repeat(43)}`)
    expect(result.key).toMatchObject({
      id: "key-1",
      organizationId: "org-1",
      fingerprint: "fingerprint-1",
      status: "ACTIVE",
    })
    expect(result.key).not.toHaveProperty("keyHash")
    expect(database.whatsappOrganizationApiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          keyHash: "one-way-hash",
          fingerprint: expect.any(String),
        }),
      })
    )
    expect(
      JSON.stringify(database.whatsappOrganizationApiKey.create.mock.calls)
    ).not.toContain(`wa_live_${"s".repeat(43)}`)
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ORGANIZATION_API_KEY_GENERATED",
        organizationId: "org-1",
        adminId: "admin-1",
      })
    )
  })

  it("refuses a second active key for the same organization", async () => {
    const database = createDatabase()
    database.whatsappOrganizationApiKey.findFirst.mockResolvedValue(record())
    const service = new WhatsappOrganizationApiKeysService(
      database as unknown as PrismaClient
    )

    await expect(
      service.generate({ organizationId: "org-1", actorId: "admin-1" })
    ).rejects.toBeInstanceOf(WhatsappOrganizationApiKeyAlreadyActiveError)
    expect(database.whatsappOrganizationApiKey.create).not.toHaveBeenCalled()
  })

  it("rotates atomically and records the prior key as revoked", async () => {
    const database = createDatabase()
    const previous = record()
    const next = record({
      id: "key-2",
      fingerprint: "fingerprint-2",
      createdAt: timestamp,
    })
    database.whatsappOrganizationApiKey.findFirst.mockResolvedValue(previous)
    database.whatsappOrganizationApiKey.update.mockResolvedValue({
      ...previous,
      status: "REVOKED",
      rotatedAt: timestamp,
      revokedAt: timestamp,
    })
    database.whatsappOrganizationApiKey.create.mockResolvedValue(next)
    const service = new WhatsappOrganizationApiKeysService(
      database as unknown as PrismaClient,
      async () => [],
      () => timestamp
    )

    const result = await service.rotate({
      organizationId: "org-1",
      actorId: "admin-1",
    })

    expect(result.previousKey.status).toBe("REVOKED")
    expect(result.key.id).toBe("key-2")
    expect(result.secret).toContain("wa_live_")
    expect(database.whatsappOrganizationApiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "key-1" },
        data: expect.objectContaining({
          status: "REVOKED",
          revokedByWorkosUserId: "admin-1",
        }),
      })
    )
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ORGANIZATION_API_KEY_ROTATED" })
    )
  })

  it("revokes the active key and rejects revocation without one", async () => {
    const database = createDatabase()
    database.whatsappOrganizationApiKey.findFirst.mockResolvedValue(record())
    database.whatsappOrganizationApiKey.update.mockResolvedValue(
      record({ status: "REVOKED", revokedAt: timestamp })
    )
    const service = new WhatsappOrganizationApiKeysService(
      database as unknown as PrismaClient,
      async () => [],
      () => timestamp
    )

    const revoked = await service.revoke({
      organizationId: "org-1",
      actorId: "admin-1",
    })
    expect(revoked.status).toBe("REVOKED")
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ORGANIZATION_API_KEY_REVOKED" })
    )

    database.whatsappOrganizationApiKey.findFirst.mockResolvedValue(null)
    await expect(
      service.revoke({ organizationId: "org-1", actorId: "admin-1" })
    ).rejects.toBeInstanceOf(WhatsappOrganizationApiKeyNotFoundError)
  })

  it("returns the active organization key state without tenant fields", async () => {
    const database = createDatabase()
    database.whatsappOrganizationApiKey.findMany.mockResolvedValue([
      record({
        id: "key-2",
        fingerprint: "fingerprint-2",
        createdAt: new Date("2026-08-15T10:00:00.000Z"),
      }),
      record({
        id: "key-1",
        status: "REVOKED",
        createdAt: new Date("2026-08-14T10:00:00.000Z"),
        revokedAt: timestamp,
      }),
    ])
    const service = new WhatsappOrganizationApiKeysService(
      database as unknown as PrismaClient
    )

    const state = await service.getOrganizationKeyState("org-1")

    expect(state).toEqual({
      status: "ACTIVE",
      keyId: "key-2",
      fingerprint: "fingerprint-2",
      generatedKeyCount: 2,
      createdAt: "2026-08-15T10:00:00.000Z",
      rotatedAt: null,
      revokedAt: null,
      lastUsedAt: null,
    })
    expect(database.whatsappOrganizationApiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
        orderBy: { createdAt: "desc" },
      })
    )
    expect(JSON.stringify(state)).not.toContain("organizationId")
  })

  it("returns a not-generated state when an organization has no keys", async () => {
    const database = createDatabase()
    const service = new WhatsappOrganizationApiKeysService(
      database as unknown as PrismaClient
    )

    await expect(service.getOrganizationKeyState("org-1")).resolves.toEqual({
      status: "NOT_GENERATED",
      keyId: null,
      fingerprint: null,
      generatedKeyCount: 0,
      createdAt: null,
      rotatedAt: null,
      revokedAt: null,
      lastUsedAt: null,
    })
  })

  it("includes organizations without keys and returns only redacted inventory fields", async () => {
    const database = createDatabase()
    database.whatsappOrganizationApiKey.findMany.mockResolvedValue([
      record(),
      record({
        id: "key-0",
        fingerprint: "fingerprint-0",
        status: "REVOKED",
        createdAt: new Date("2026-08-01T10:00:00.000Z"),
      }),
    ])
    const service = new WhatsappOrganizationApiKeysService(
      database as unknown as PrismaClient,
      async () => [
        { id: "org-1", name: "Org One", slug: "org-1" },
        { id: "org-2", name: "Org Two", slug: "org-2" },
      ]
    )

    const inventory = await service.listInventory({
      page: 1,
      limit: 20,
    })

    expect(inventory.summary).toEqual({
      generatedKeyTotal: 2,
      organizationsWithActiveKey: 1,
      organizationsWithoutActiveKey: 1,
    })
    expect(inventory.data).toHaveLength(2)
    expect(
      inventory.data.find((row) => row.organizationId === "org-2")
    ).toMatchObject({
      status: "NOT_GENERATED",
      keyId: null,
      fingerprint: null,
    })
    expect(JSON.stringify(inventory)).not.toContain("keyHash")
  })
})
