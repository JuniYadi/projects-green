import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// Mock @/lib/encryption
mock.module("@/lib/encryption", () => ({
  encrypt: (_plaintext: string) => ({
    encrypted: Buffer.from(_plaintext).toString("base64"),
    iv: "dGVzdC1pdg==",
    tag: "dGVzdC10YWc=",
  }),
  decrypt: (data: { encrypted: string }) =>
    Buffer.from(data.encrypted, "base64").toString("utf8"),
  parseEncryptedField: (value: string | null) => {
    if (!value) return null
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  },
  serializeEncryptedField: (data: unknown) => JSON.stringify(data),
}))

const mockPrisma: Record<string, unknown> = {
  paymentGateway: {
    findMany: mock(() => Promise.resolve([])),
    findUnique: mock(() => Promise.resolve(null)),
    findFirst: mock(() => Promise.resolve(null)),
    create: mock(() =>
      Promise.resolve({
        id: "gw_new",
        name: "",
        type: "",
        isActive: true,
        isDefault: false,
        supportedCurrencies: [],
        config: null,
      })
    ),
    update: mock(() => Promise.resolve({})),
    updateMany: mock(() => Promise.resolve({ count: 0 })),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const { GatewayService } =
  await import("@/modules/payment/services/gateway.service")

const mockEncryption = {
  encryptField: (value: string) => `encrypted:${value}`,
  decryptField: (value: string) => String(value).replace("encrypted:", ""),
  decryptFieldOptional: (value: string | null) => {
    if (!value) return null
    return String(value).replace("encrypted:", "")
  },
}

describe("GatewayService", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: any

  const pg = mockPrisma.paymentGateway as {
    findMany: ReturnType<typeof mock>
    findUnique: ReturnType<typeof mock>
    findFirst: ReturnType<typeof mock>
    create: ReturnType<typeof mock>
    update: ReturnType<typeof mock>
    updateMany: ReturnType<typeof mock>
  }

  beforeEach(() => {
    pg.findMany.mockReset()
    pg.findUnique.mockReset()
    pg.findFirst.mockReset()
    pg.create.mockReset()
    pg.update.mockReset()
    pg.updateMany.mockReset()

    pg.findMany.mockResolvedValue([])
    pg.findUnique.mockResolvedValue(null)
    pg.findFirst.mockResolvedValue(null)
    pg.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => ({
        id: "gw_new",
        name: args.data.name ?? "",
        type: args.data.type ?? "",
        isActive: true,
        isDefault: (args.data.isDefault as boolean) ?? false,
        supportedCurrencies: (args.data.supportedCurrencies as string[]) ?? [],
        config: (args.data.config as string) ?? null,
      })
    )
    pg.update.mockResolvedValue({})
    pg.updateMany.mockResolvedValue({ count: 0 })

    service = new GatewayService(mockEncryption as never)
  })

  afterEach(() => {
    mock.restore?.()
  })

  describe("list", () => {
    it("returns active gateways by default", async () => {
      const result = await service.list()
      expect(result).toEqual([])
      expect(pg.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } })
      )
    })

    it("returns all gateways when includeInactive is true", async () => {
      await service.list(true)
      expect(pg.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      )
    })
  })

  describe("findById", () => {
    it("returns null when not found", async () => {
      const result = await service.findById("nonexistent")
      expect(result).toBeNull()
    })
  })

  describe("findByType", () => {
    it("returns null when not found", async () => {
      const result = await service.findByType("DUITKU")
      expect(result).toBeNull()
    })
  })

  describe("listForCurrency", () => {
    it("returns empty when no gateways", async () => {
      const result = await service.listForCurrency("USD")
      expect(result).toEqual([])
    })
  })

  describe("findByTypeForCurrency", () => {
    it("returns null when no matching gateway", async () => {
      const result = await service.findByTypeForCurrency("DUITKU", "USD")
      expect(result).toBeNull()
    })
  })

  describe("toggle", () => {
    it("throws when gateway not found", async () => {
      pg.findUnique.mockResolvedValue(null)
      await expect(service.toggle("gw_1")).rejects.toThrow("Gateway not found")
    })
  })

  describe("getDecryptedConfig", () => {
    it("returns null when gateway not found", async () => {
      const result = await service.getDecryptedConfig("gw_1")
      expect(result).toBeNull()
    })
  })

  describe("create", () => {
    it("creates a new gateway", async () => {
      const result = await service.create({
        name: "Duitku",
        type: "DUITKU",
        config: {
          merchantCode: "MC001",
          apiKey: "key123",
          sandboxUrl: "",
          productionUrl: "",
        },
      })
      expect(result.name).toBe("Duitku")
    })

    it("un-sets default on other gateways when new one is default", async () => {
      await service.create({
        name: "Duitku",
        type: "DUITKU",
        config: {
          merchantCode: "MC001",
          apiKey: "key123",
          sandboxUrl: "",
          productionUrl: "",
        },
        isDefault: true,
      })
      expect(pg.updateMany).toHaveBeenCalled()
    })
  })

  describe("update", () => {
    it("throws when gateway not found", async () => {
      pg.findUnique.mockResolvedValue(null)
      await expect(
        service.update("gw_1", { name: "New Name" })
      ).rejects.toThrow("Gateway not found")
    })

    it("un-sets default on other gateways when making this one default", async () => {
      pg.findUnique.mockResolvedValue({
        id: "gw_1",
        type: "DUITKU",
        isDefault: false,
      })
      pg.update.mockResolvedValue({ id: "gw_1", isDefault: true })
      await service.update("gw_1", { isDefault: true })
      expect(pg.updateMany).toHaveBeenCalled()
    })
  })
})
