import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { PrismaClient } from "@prisma/client"

const mockCreate = mock(async (_args: unknown): Promise<any> => null)
const mockFindMany = mock(async (_args: unknown): Promise<any> => [])
const mockFindUnique = mock(async (_args: unknown): Promise<any> => null)
const mockFindFirst = mock(async (_args: unknown): Promise<any> => null)
const mockUpdate = mock(async (_args: unknown): Promise<any> => null)
const mockDelete = mock(async (_args: unknown): Promise<any> => null)
const mockDeviceCount = mock(async (_args: unknown): Promise<number> => 0)
const mockEncrypt = mock(async (value: string) => `encrypted:${value}`)
const mockDecrypt = mock(async (value: string) =>
  value.replace(/^encrypted:/, "")
)
const mockAudit = mock(async (_params: unknown): Promise<void> => {})
const mockPrisma: Record<string, unknown> = {
  whatsappMetaApp: {
    create: mockCreate,
    findMany: mockFindMany,
    findUnique: mockFindUnique,
    update: mockUpdate,
    delete: mockDelete,
  },
  whatsappDevice: {
    count: mockDeviceCount,
    findFirst: mockFindFirst,
  },
}
const mockQueryRaw = mock(async (_query: unknown) => [])
const mockTransaction = mock(
  async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
    callback(mockPrisma)
)
mockPrisma.$queryRaw = mockQueryRaw
mockPrisma.$transaction = mockTransaction

mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

mock.module("@/lib/whatsapp/crypto", () => ({
  encryptWithAppKey: mockEncrypt,
  decryptWithAppKey: mockDecrypt,
}))

mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockAudit,
}))

mock.module("node:crypto", () => ({
  randomBytes: mock(() => Buffer.from("k".repeat(32))),
}))

const { MetaAppsService } = await import("./meta-apps.service")
const { createMetaAppSchema, updateMetaAppSchema } =
  await import("./meta-apps.schemas")

const timestamps = {
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
}

const appRecord = {
  id: "meta-1",
  name: "Primary",
  metaAppId: "123456789",
  appSecretEncrypted: "encrypted:app-secret",
  verifyTokenEncrypted: "encrypted:verify-token",
  webhookKey: "k".repeat(64),
  active: true,
  ...timestamps,
}

const deviceRecord = {
  id: "device-1",
  organizationId: "org-1",
  whatsappMetaAppId: "meta-1",
  whatsappPhoneId: "phone-1",
}

function resetMocks() {
  mockCreate.mockClear()
  mockFindMany.mockClear()
  mockFindUnique.mockClear()
  mockFindFirst.mockClear()
  mockUpdate.mockClear()
  mockDelete.mockClear()
  mockDeviceCount.mockClear()
  mockQueryRaw.mockClear()
  mockTransaction.mockClear()
  mockEncrypt.mockClear()
  mockDecrypt.mockClear()
  mockAudit.mockClear()
  mockCreate.mockImplementation(async () => appRecord)
  mockFindMany.mockImplementation(async () => [appRecord])
  mockFindUnique.mockImplementation(async () => appRecord)
  mockFindFirst.mockImplementation(async () => null)
  mockUpdate.mockImplementation(async () => ({ ...appRecord, name: "Renamed" }))
  mockDelete.mockImplementation(async () => appRecord)
  mockDeviceCount.mockImplementation(async () => 0)
  mockQueryRaw.mockImplementation(async () => [])
  mockTransaction.mockImplementation(
    async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
      callback(mockPrisma)
  )
  mockEncrypt.mockImplementation(async (value: string) => `encrypted:${value}`)
  mockDecrypt.mockImplementation(async (value: string) =>
    value.replace(/^encrypted:/, "")
  )
  mockAudit.mockImplementation(async () => undefined)
}

describe("Meta app schemas", () => {
  it("accepts valid create and update inputs", () => {
    expect(
      createMetaAppSchema.parse({
        name: " Primary ",
        metaAppId: "123456789",
        appSecret: "app-secret",
        verifyToken: "verify-token",
        active: true,
      })
    ).toEqual({
      name: "Primary",
      metaAppId: "123456789",
      appSecret: "app-secret",
      verifyToken: "verify-token",
      active: true,
    })
    expect(updateMetaAppSchema.parse({ active: false })).toEqual({
      active: false,
    })
  })

  it("rejects empty, overlong, and encrypted input fields", () => {
    expect(() =>
      createMetaAppSchema.parse({
        name: "",
        metaAppId: "1",
        appSecret: "secret",
        verifyToken: "token",
      })
    ).toThrow()
    expect(() =>
      createMetaAppSchema.parse({
        name: "Name",
        metaAppId: "1",
        appSecret: "secret",
        verifyToken: "x".repeat(513),
      })
    ).toThrow()
    expect(() =>
      updateMetaAppSchema.parse({
        appSecretEncrypted: "v1.ciphertext",
      })
    ).toThrow()
    expect(() => updateMetaAppSchema.parse({})).toThrow()
  })
})

describe("MetaAppsService", () => {
  let service: InstanceType<typeof MetaAppsService>

  beforeEach(() => {
    process.env.APP_KEY = Buffer.alloc(32, "a").toString("base64")
    resetMocks()
    service = new MetaAppsService(mockPrisma as unknown as PrismaClient)
  })

  it("encrypts credentials before create and returns redacted DTO", async () => {
    const result = await service.create(
      {
        name: "Primary",
        metaAppId: "123456789",
        appSecret: "app-secret",
        verifyToken: "verify-token",
      },
      "admin-1"
    )

    expect(mockEncrypt).toHaveBeenNthCalledWith(1, "app-secret")
    expect(mockEncrypt).toHaveBeenNthCalledWith(2, "verify-token")
    const createArgs = mockCreate.mock.calls[0]?.[0] as any
    expect(createArgs.data.appSecretEncrypted).toBe("encrypted:app-secret")
    expect(createArgs.data.verifyTokenEncrypted).toBe("encrypted:verify-token")
    expect(createArgs.data).not.toHaveProperty("appSecret")
    expect(createArgs.data).not.toHaveProperty("verifyToken")
    expect(result).toEqual({
      id: "meta-1",
      name: "Primary",
      metaAppId: "123456789",
      webhookKey: appRecord.webhookKey,
      active: true,
      ...timestamps,
      callbackPath: `/api/whatsapp/meta-webhook/${appRecord.webhookKey}`,
    })
    expect(result).not.toHaveProperty("appSecret")
    expect(result).not.toHaveProperty("verifyToken")
    expect(result).not.toHaveProperty("appSecretEncrypted")
    expect(result).not.toHaveProperty("verifyTokenEncrypted")
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "META_APP_CREATED",
        organizationId: "system",
        adminId: "admin-1",
        details: {
          metaAppId: "123456789",
          changedFields: [
            "name",
            "metaAppId",
            "appSecret",
            "verifyToken",
            "active",
          ],
        },
      })
    )
  })

  it("logs metadata updates separately from credential rotation", async () => {
    await service.update("meta-1", { name: "Renamed" }, "admin-1")

    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "META_APP_UPDATED",
        details: {
          metaAppId: "123456789",
          changedFields: ["name"],
        },
      })
    )
  })

  it("rotates only supplied credentials and maps updates", async () => {
    await service.update(
      "meta-1",
      { name: "Renamed", appSecret: "new-secret" },
      "admin-1"
    )

    const updateArgs = mockUpdate.mock.calls[0]?.[0] as any
    expect(updateArgs.data).toEqual({
      name: "Renamed",
      appSecretEncrypted: "encrypted:new-secret",
    })
    expect(updateArgs.data).not.toHaveProperty("verifyTokenEncrypted")
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "META_APP_CREDENTIALS_ROTATED",
        details: {
          metaAppId: "123456789",
          changedFields: ["name", "appSecret"],
        },
      })
    )
  })

  it("distinguishes which credentials were rotated without logging values", async () => {
    const rotations = [
      { input: { appSecret: "new-secret" }, fields: ["appSecret"] },
      { input: { verifyToken: "new-token" }, fields: ["verifyToken"] },
      {
        input: { appSecret: "both-secret", verifyToken: "both-token" },
        fields: ["appSecret", "verifyToken"],
      },
    ] as const

    for (const rotation of rotations) {
      mockAudit.mockClear()
      await service.update("meta-1", rotation.input, "admin-1")

      expect(mockAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "META_APP_CREDENTIALS_ROTATED",
          details: {
            metaAppId: "123456789",
            changedFields: rotation.fields,
          },
        })
      )
      const auditCall = mockAudit.mock.calls[0]?.[0] as {
        details?: unknown
      }
      const details = JSON.stringify(auditCall.details)
      for (const secret of Object.values(rotation.input)) {
        expect(details).not.toContain(secret)
        expect(details).not.toContain(`encrypted:${secret}`)
      }
    }
  })

  it("lists metadata with attached device counts", async () => {
    mockFindMany.mockResolvedValueOnce([
      { ...appRecord, _count: { devices: 3 } },
    ])
    const listed = await service.list()
    expect(mockFindMany.mock.calls[0]?.[0]).toEqual({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { devices: true } } },
    })
    expect(listed[0]).not.toHaveProperty("appSecretEncrypted")
    expect(listed[0]?.deviceCount).toBe(3)
  })

  it("resolves credentials by webhook key", async () => {
    const resolved = await service.resolveCredentialsByWebhookKey("public-key")
    expect(resolved).toEqual({
      id: "meta-1",
      name: "Primary",
      metaAppId: "123456789",
      webhookKey: appRecord.webhookKey,
      active: true,
      appSecret: "app-secret",
      verifyToken: "verify-token",
    })
    expect(mockDecrypt).toHaveBeenNthCalledWith(1, appRecord.appSecretEncrypted)
    expect(mockDecrypt).toHaveBeenNthCalledWith(
      2,
      appRecord.verifyTokenEncrypted
    )
  })
  it("returns null when encrypted credentials cannot be decrypted", async () => {
    mockDecrypt.mockRejectedValueOnce(new Error("corrupt ciphertext"))
    expect(
      await service.resolveCredentialsByWebhookKey("public-key")
    ).toBeNull()
  })
  it("returns null when decrypted credentials are empty", async () => {
    mockDecrypt.mockResolvedValueOnce("")
    expect(
      await service.resolveCredentialsByWebhookKey("public-key")
    ).toBeNull()
  })

  it("deletes app when no devices are attached", async () => {
    const result = await service.delete("meta-1", "admin-1")
    expect(mockDeviceCount).toHaveBeenCalledWith({
      where: { whatsappMetaAppId: "meta-1" },
    })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "meta-1" } })
    expect(result?.id).toBe("meta-1")
    expect(mockAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "META_APP_DELETED",
        organizationId: "system",
        adminId: "admin-1",
        details: {
          metaAppId: "123456789",
          changedFields: [],
        },
      })
    )
  })
  it("maps concurrent device attachment FK conflicts", async () => {
    mockUpdate.mockRejectedValueOnce({ code: "P2003" })
    await expect(service.deactivate("meta-1")).rejects.toMatchObject({
      code: "META_APP_HAS_DEVICES",
    })

    mockDelete.mockRejectedValueOnce({ code: "P2003" })
    await expect(service.delete("meta-1", "admin-1")).rejects.toMatchObject({
      code: "META_APP_HAS_DEVICES",
    })
    expect(mockAudit).not.toHaveBeenCalled()
  })

  it("scopes device lookup to Meta app and phone ID", async () => {
    mockFindFirst.mockResolvedValueOnce(deviceRecord)
    await service.resolveDeviceByPhoneId("meta-1", "phone-1")
    expect(mockFindFirst.mock.calls[0]?.[0]).toEqual({
      where: { whatsappMetaAppId: "meta-1", whatsappPhoneId: "phone-1" },
    })
  })

  it("rejects inactive resolver and deletion with attached devices", async () => {
    mockFindUnique.mockResolvedValueOnce({ ...appRecord, active: false })
    expect(
      await service.resolveCredentialsByWebhookKey("public-key")
    ).toBeNull()

    mockFindUnique.mockResolvedValueOnce(appRecord)
    mockDeviceCount.mockResolvedValueOnce(1)
    await expect(service.delete("meta-1", "admin-1")).rejects.toMatchObject({
      code: "META_APP_HAS_DEVICES",
    })
    expect(mockDelete).not.toHaveBeenCalled()
    mockDeviceCount.mockResolvedValueOnce(1)
    await expect(
      service.update("meta-1", { active: false }, "admin-1")
    ).rejects.toMatchObject({
      code: "META_APP_HAS_DEVICES",
    })
  })
})
