import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// Mock prisma before any imports
const mockTx = {
  whatsappDevice: {
    findFirst: mock(() => Promise.resolve(null)),
  },
  whatsappMonthlyCount: {
    findFirst: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve({ id: "count-1", messageOutboxCount: 1 })),
    update: mock(() => Promise.resolve({ id: "count-1", messageOutboxCount: 1 })),
  },
}

const mockPrisma = {
  whatsappDevice: {
    findFirst: mock(() => Promise.resolve(null)),
  },
  whatsappMonthlyCount: {
    findFirst: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve({ id: "count-1", messageOutboxCount: 1 })),
    update: mock(() => Promise.resolve({ id: "count-1", messageOutboxCount: 1 })),
  },
  $transaction: mock((fn: any) => fn(mockTx)),
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// Dynamic import for the service
const { quotaService, InsufficientQuotaError } = await import("./quota.service")

// Mock Date
const FIXED_DATE = new Date("2026-05-15T00:00:00Z")
const OriginalDate = global.Date
global.Date = class extends OriginalDate {
  constructor(...args: any[]) {
    if (args.length === 0) return new OriginalDate(FIXED_DATE)
    return new OriginalDate(args[0])
  }
} as any

describe("quotaService", () => {
  beforeEach(() => {
    mockPrisma.whatsappDevice.findFirst.mockReset()
    mockPrisma.whatsappMonthlyCount.findFirst.mockReset()
    mockPrisma.whatsappMonthlyCount.create.mockReset()
    mockPrisma.whatsappMonthlyCount.update.mockReset()
    mockPrisma.$transaction.mockReset()
    mockTx.whatsappDevice.findFirst.mockReset()
    mockTx.whatsappMonthlyCount.findFirst.mockReset()
    mockTx.whatsappMonthlyCount.create.mockReset()
    mockTx.whatsappMonthlyCount.update.mockReset()

    mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockTx))

    // Default implementations to avoid returning undefined
    mockPrisma.whatsappMonthlyCount.create.mockResolvedValue({ id: "count-1", messageOutboxCount: 1 } as any)
    mockPrisma.whatsappMonthlyCount.update.mockResolvedValue({ id: "count-1", messageOutboxCount: 1 } as any)
    mockTx.whatsappMonthlyCount.create.mockResolvedValue({ id: "count-1", messageOutboxCount: 1 } as any)
    mockTx.whatsappMonthlyCount.update.mockResolvedValue({ id: "count-1", messageOutboxCount: 1 } as any)
  })

  describe("InsufficientQuotaError", () => {
    it("creates error with correct name and message", () => {
      const err = new InsufficientQuotaError("no quota left")
      expect(err.name).toBe("InsufficientQuotaError")
      expect(err.message).toBe("no quota left")
    })
  })

  describe("checkQuota", () => {
    it("returns hasQuota true when device has limit and count below", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 100,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue({
        messageOutboxCount: 50,
      } as any)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(true)
      expect(result.currentCount).toBe(50)
      expect(result.monthlyLimit).toBe(100)
      expect(result.remaining).toBe(50)
    })

    it("returns hasQuota false when remaining is zero", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 100,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue({
        messageOutboxCount: 100,
      } as any)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(false)
      expect(result.currentCount).toBe(100)
      expect(result.remaining).toBe(0)
    })

    it("returns hasQuota false when no device found", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue(null)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(null)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(false)
      expect(result.monthlyLimit).toBe(0)
      expect(result.remaining).toBe(0)
    })

    it("returns hasQuota true when no quota limit set (unlimited)", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: null,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(null)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(true)
      expect(result.monthlyLimit).toBe(0)
    })

    it("uses deviceId when provided", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 200,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(null)

      await quotaService.checkQuota("org-1", "device-1")

      expect(mockPrisma.whatsappDevice.findFirst).toHaveBeenCalledWith({
        where: { id: "device-1", organizationId: "org-1" },
      })
    })

    it("handles string quota values", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: "50" as any,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue({
        messageOutboxCount: 10,
      } as any)

      const result = await quotaService.checkQuota("org-1")

      expect(result.monthlyLimit).toBe(50)
      expect(result.remaining).toBe(40)
    })
  })

  describe("deductQuota", () => {
    it("creates new monthly count when none exists", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 100,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValue(null)
      mockTx.whatsappMonthlyCount.create.mockResolvedValue({
        id: "count-new",
        messageOutboxCount: 1,
      } as any)

      await quotaService.deductQuota("org-1")

      expect(mockTx.whatsappMonthlyCount.create).toHaveBeenCalled()
    })

    it("updates existing monthly count", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 100,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValue({
        id: "count-1",
        messageOutboxCount: 5,
      } as any)
      mockTx.whatsappMonthlyCount.update.mockResolvedValue({
        id: "count-1",
        messageOutboxCount: 6,
      } as any)

      await quotaService.deductQuota("org-1")

      expect(mockTx.whatsappMonthlyCount.update).toHaveBeenCalledWith({
        where: { id: "count-1" },
        data: { messageOutboxCount: { increment: 1 } },
      })
    })

    it("throws when device not found", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValue(null)

      await expect(quotaService.deductQuota("org-1")).rejects.toThrow(
        "WhatsApp device not found"
      )
    })

    it("throws InsufficientQuotaError when limit exceeded", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 10,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValue({
        id: "count-1",
        messageOutboxCount: 10,
      } as any)
      mockTx.whatsappMonthlyCount.update.mockResolvedValue({
        id: "count-1",
        messageOutboxCount: 11,
      } as any)

      await expect(quotaService.deductQuota("org-1")).rejects.toThrow(
        /Monthly quota exceeded/
      )
    })

    it("allows send when count equals limit (within quota)", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 10,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValue({
        id: "count-1",
        messageOutboxCount: 9,
      } as any)
      mockTx.whatsappMonthlyCount.update.mockResolvedValue({
        id: "count-1",
        messageOutboxCount: 10,
      } as any)

      await expect(quotaService.deductQuota("org-1")).resolves.toBeUndefined()
    })

    it("uses deviceId in deductQuota when provided", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 100,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValue(null)
      mockTx.whatsappMonthlyCount.create.mockResolvedValue({
        id: "count-new",
        messageOutboxCount: 1,
      } as any)

      await quotaService.deductQuota("org-1", "device-1")

      expect(mockTx.whatsappDevice.findFirst).toHaveBeenCalledWith({
        where: { id: "device-1", organizationId: "org-1" },
      })
      expect(mockTx.whatsappMonthlyCount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            whatsappDeviceId: "device-1",
          }),
        })
      )
    })
  })

  describe("getMonthlyStats", () => {
    it("returns inbox and outbox counts", async () => {
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue({
        messageInboxCount: 25,
        messageOutboxCount: 50,
      } as any)

      const result = await quotaService.getMonthlyStats("org-1")

      expect(result).toEqual({ inCount: 25, outCount: 50 })
    })

    it("returns zeros when no monthly count", async () => {
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(null)

      const result = await quotaService.getMonthlyStats("org-1")

      expect(result).toEqual({ inCount: 0, outCount: 0 })
    })

    it("filters by deviceId", async () => {
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(null)

      await quotaService.getMonthlyStats("org-1", "device-1")

      expect(mockPrisma.whatsappMonthlyCount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            whatsappDeviceId: "device-1",
          }),
        })
      )
    })
  })
})
