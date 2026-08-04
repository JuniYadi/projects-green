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
  mockCreate.mockReset()
  mockFindMany.mockReset()
  mockFindUnique.mockReset()
  mockFindFirst.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
  mockQueryRaw.mockReset()
  mockTransaction.mockReset()
  mockEncrypt.mockReset()
  mockDecrypt.mockReset()
  mockCreate.mockResolvedValue(appRecord)
  mockFindMany.mockResolvedValue([appRecord])
  mockFindUnique.mockResolvedValue(appRecord)
  mockFindFirst.mockResolvedValue(null)
  mockUpdate.mockResolvedValue({ ...appRecord, name: "Renamed" })
  mockDelete.mockResolvedValue(appRecord)
  mockDeviceCount.mockResolvedValue(0)
  mockQueryRaw.mockResolvedValue([])
  mockTransaction.mockImplementation(
    async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
      callback(mockPrisma)
  )
  mockEncrypt.mockImplementation(async (value: string) => `encrypted:${value}`)
  mockDecrypt.mockImplementation(async (value: string) =>
    value.replace(/^encrypted:/, "")
  )
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
    const result = await service.create({
      name: "Primary",
      metaAppId: "123456789",
      appSecret: "app-secret",
      verifyToken: "verify-token",
    })

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
  })

  it("rotates only supplied credentials and maps updates", async () => {
    await service.update("meta-1", { name: "Renamed", appSecret: "new-secret" })

    const updateArgs = mockUpdate.mock.calls[0]?.[0] as any
    expect(updateArgs.data).toEqual({
      name: "Renamed",
      appSecretEncrypted: "encrypted:new-secret",
    })
    expect(updateArgs.data).not.toHaveProperty("verifyTokenEncrypted")
  })

  it("lists active metadata and resolves credentials by webhook key", async () => {
    const listed = await service.list()
    expect(mockFindMany.mock.calls[0]?.[0]).toEqual({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    })
    expect(listed[0]).not.toHaveProperty("appSecretEncrypted")

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
    const result = await service.delete("meta-1")
    expect(mockDeviceCount).toHaveBeenCalledWith({
      where: { whatsappMetaAppId: "meta-1" },
    })
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "meta-1" } })
    expect(result?.id).toBe("meta-1")
  })
  it("maps concurrent device attachment FK conflicts", async () => {
    mockUpdate.mockRejectedValueOnce({ code: "P2003" })
    await expect(service.deactivate("meta-1")).rejects.toMatchObject({
      code: "META_APP_HAS_DEVICES",
    })

    mockDelete.mockRejectedValueOnce({ code: "P2003" })
    await expect(service.delete("meta-1")).rejects.toMatchObject({
      code: "META_APP_HAS_DEVICES",
    })
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
    await expect(service.delete("meta-1")).rejects.toMatchObject({
      code: "META_APP_HAS_DEVICES",
    })
    expect(mockDelete).not.toHaveBeenCalled()
    mockDeviceCount.mockResolvedValueOnce(1)
    await expect(
      service.update("meta-1", { active: false })
    ).rejects.toMatchObject({
      code: "META_APP_HAS_DEVICES",
    })
  })
})
