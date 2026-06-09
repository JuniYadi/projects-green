import { describe, expect, it, beforeEach, vi } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

const mockPrisma = {
  $transaction: vi.fn(),
  currency: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma as unknown as PrismaClient,
}))

const {
  CurrencyService,
  CurrencyNotFoundError,
  BaseCurrencyMissingError,
} = await import("./currency.service")

function decimal(value: string | number) {
  return new Prisma.Decimal(value)
}

function currency(overrides: Record<string, unknown> = {}) {
  return {
    id: "cur_usd",
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    isBase: true,
    ratePerBase: decimal("1"),
    minTopup: decimal("5"),
    maxTopup: decimal("10000"),
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

const USD = currency()
const IDR = currency({
  id: "cur_idr",
  code: "IDR",
  name: "Indonesian Rupiah",
  symbol: "Rp",
  isBase: false,
  ratePerBase: decimal("18000"),
  minTopup: decimal("90000"),
  maxTopup: decimal("180000000"),
})

describe("CurrencyService", () => {
  let service: InstanceType<typeof CurrencyService>

  beforeEach(() => {
    mockPrisma.$transaction.mockClear()
    mockPrisma.currency.findMany.mockClear()
    mockPrisma.currency.findUnique.mockClear()
    mockPrisma.currency.findFirst.mockClear()
    mockPrisma.currency.create.mockClear()
    mockPrisma.currency.update.mockClear()
    mockPrisma.currency.updateMany.mockClear()
    service = new CurrencyService(mockPrisma as unknown as PrismaClient)
  })

  describe("getByCode", () => {
    it("returns the currency when found", async () => {
      mockPrisma.currency.findUnique.mockResolvedValue(IDR)
      const result = await service.getByCode("IDR")
      expect(result.code).toBe("IDR")
    })

    it("throws CurrencyNotFoundError when missing", async () => {
      mockPrisma.currency.findUnique.mockResolvedValue(null)
      await expect(service.getByCode("EUR")).rejects.toBeInstanceOf(
        CurrencyNotFoundError
      )
    })
  })

  describe("getBase", () => {
    it("returns the base currency", async () => {
      mockPrisma.currency.findFirst.mockResolvedValue(USD)
      const base = await service.getBase()
      expect(base.isBase).toBe(true)
    })

    it("throws BaseCurrencyMissingError when none configured", async () => {
      mockPrisma.currency.findFirst.mockResolvedValue(null)
      await expect(service.getBase()).rejects.toBeInstanceOf(
        BaseCurrencyMissingError
      )
    })
  })

  describe("convert", () => {
    it("returns the same amount when from === to", async () => {
      const result = await service.convert(100, "USD", "USD")
      expect(result.toNumber()).toBe(100)
      expect(mockPrisma.currency.findUnique).not.toHaveBeenCalled()
    })

    it("converts base USD to IDR using the rate", async () => {
      mockPrisma.currency.findUnique.mockImplementation(({ where }) =>
        Promise.resolve(where.code === "USD" ? USD : IDR)
      )
      // 10 USD * (18000 / 1) = 180000 IDR
      const result = await service.convert(10, "USD", "IDR")
      expect(result.toNumber()).toBe(180000)
    })

    it("converts IDR to USD using the rate", async () => {
      mockPrisma.currency.findUnique.mockImplementation(({ where }) =>
        Promise.resolve(where.code === "USD" ? USD : IDR)
      )
      // 180000 IDR / 18000 * 1 = 10 USD
      const result = await service.convert(180000, "IDR", "USD")
      expect(result.toNumber()).toBe(10)
    })
  })

  describe("toBase / fromBase", () => {
    it("toBase divides by the rate", async () => {
      mockPrisma.currency.findUnique.mockResolvedValue(IDR)
      const result = await service.toBase(180000, "IDR")
      expect(result.toNumber()).toBe(10)
    })

    it("fromBase multiplies by the rate", async () => {
      mockPrisma.currency.findUnique.mockResolvedValue(IDR)
      const result = await service.fromBase(10, "IDR")
      expect(result.toNumber()).toBe(180000)
    })
  })

  describe("create", () => {
    it("pins ratePerBase to 1 when creating a base currency and unsets others", async () => {
      const tx = {
        currency: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        },
      }
      mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

      const result = await service.create({
        code: "usd",
        name: "US Dollar",
        symbol: "$",
        isBase: true,
        ratePerBase: 999,
        minTopup: 5,
        maxTopup: 10000,
      })

      expect(tx.currency.updateMany).toHaveBeenCalledWith({
        where: { isBase: true },
        data: { isBase: false },
      })
      expect(result.code).toBe("USD")
      expect((result.ratePerBase as Prisma.Decimal).toNumber()).toBe(1)
    })

    it("stores the provided rate for a non-base currency", async () => {
      const tx = {
        currency: {
          updateMany: vi.fn(),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        },
      }
      mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

      const result = await service.create({
        code: "IDR",
        name: "Indonesian Rupiah",
        symbol: "Rp",
        ratePerBase: 18000,
        minTopup: 90000,
        maxTopup: 180000000,
      })

      expect(tx.currency.updateMany).not.toHaveBeenCalled()
      expect((result.ratePerBase as Prisma.Decimal).toNumber()).toBe(18000)
    })
  })

  describe("update", () => {
    it("ignores rate edits on the base currency", async () => {
      const tx = {
        currency: {
          findUnique: vi.fn().mockResolvedValue(USD),
          updateMany: vi.fn(),
          update: vi.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        },
      }
      mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

      const result = await service.update("cur_usd", { ratePerBase: 500 })
      expect((result.ratePerBase as Prisma.Decimal).toNumber()).toBe(1)
    })

    it("throws CurrencyNotFoundError when the row is missing", async () => {
      const tx = {
        currency: {
          findUnique: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn(),
          update: vi.fn(),
        },
      }
      mockPrisma.$transaction.mockImplementation((cb) => cb(tx))

      await expect(service.update("missing", { name: "x" })).rejects.toBeInstanceOf(
        CurrencyNotFoundError
      )
    })
  })
})
