import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { InsufficientQuotaError } from "@/modules/whatsapp/messages/quota.service"

// Mock prisma before importing quotaService
const mockTx = {
  whatsappDevice: {
    findFirst: mock(async () => null),
  },
  whatsappMonthlyCount: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: "count-1", messageOutboxCount: 1 })),
    update: mock(async () => ({ id: "count-1", messageOutboxCount: 1 })),
  },
}

const mockPrisma = {
  whatsappDevice: {
    findFirst: mock(async () => null),
  },
  whatsappMonthlyCount: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: "count-1", messageOutboxCount: 1 })),
    update: mock(async () => ({ id: "count-1", messageOutboxCount: 1 })),
  },
  $transaction: mock(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// Import after mock
const { quotaService } = await import("@/modules/whatsapp/messages/quota.service")

describe("quotaService", () => {
  beforeEach(() => {
    mockPrisma.whatsappDevice.findFirst.mockReset()
    mockPrisma.whatsappMonthlyCount.findFirst.mockReset()
    mockPrisma.whatsappMonthlyCount.create.mockReset()
    mockPrisma.whatsappMonthlyCount.update.mockReset()
    mockPrisma.$transaction.mockReset()

    // Reset mockTx mocks
    mockTx.whatsappDevice.findFirst.mockReset()
    mockTx.whatsappMonthlyCount.findFirst.mockReset()
    mockTx.whatsappMonthlyCount.create.mockReset()
    mockTx.whatsappMonthlyCount.update.mockReset()

    // Default: transaction succeeds
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockTx))
  })

  describe("InsufficientQuotaError", () => {
    it("creates error with correct name and message", () => {
      const err = new InsufficientQuotaError("no quota left")
      expect(err.name).toBe("InsufficientQuotaError")
      expect(err.message).toBe("no quota left")
      expect(err).toBeInstanceOf(Error)
    })
  })

  describe("checkQuota", () => {
    it("returns hasQuota true when device has limit and count below", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: 100,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValueOnce({
        messageOutboxCount: 50,
      } as any)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(true)
      expect(result.currentCount).toBe(50)
      expect(result.monthlyLimit).toBe(100)
      expect(result.remaining).toBe(50)
    })

    it("returns hasQuota false when remaining is zero", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: 100,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValueOnce({
        messageOutboxCount: 100,
      } as any)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(false)
      expect(result.currentCount).toBe(100)
      expect(result.remaining).toBe(0)
    })

    it("returns hasQuota false when no device found", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce(null)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValueOnce(null)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(false)
      expect(result.monthlyLimit).toBe(0)
      expect(result.remaining).toBe(0)
    })

    it("returns hasQuota false when no quota limit set", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: null,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValueOnce(null)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(false)
      expect(result.monthlyLimit).toBe(0)
    })

    it("uses deviceId when provided", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: 200,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValueOnce(null)

      await quotaService.checkQuota("org-1", "device-1")

      expect(mockPrisma.whatsappDevice.findFirst).toHaveBeenCalledWith({
        where: { id: "device-1", organizationId: "org-1" },
      })
    })

    it("handles string quota values", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: "50" as any,
      } as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValueOnce({
        messageOutboxCount: 10,
      } as any)

      const result = await quotaService.checkQuota("org-1")

      expect(result.monthlyLimit).toBe(50)
      expect(result.remaining).toBe(40)
    })
  })

  describe("deductQuota", () => {
    it("creates new monthly count when none exists", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: 100,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValueOnce(null)
      mockTx.whatsappMonthlyCount.create.mockResolvedValueOnce({
        id: "count-new",
        messageOutboxCount: 1,
      } as any)

      await quotaService.deductQuota("org-1")

      expect(mockTx.whatsappMonthlyCount.create).toHaveBeenCalled()
    })

    it("updates existing monthly count", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: 100,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValueOnce({
        id: "count-1",
        messageOutboxCount: 5,
      } as any)
      mockTx.whatsappMonthlyCount.update.mockResolvedValueOnce({
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
      mockTx.whatsappDevice.findFirst.mockResolvedValueOnce(null)

      await expect(quotaService.deductQuota("org-1")).rejects.toThrow(
        "WhatsApp device not found"
      )
    })

    it("throws InsufficientQuotaError when limit exceeded", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: 10,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValueOnce({
        id: "count-1",
        messageOutboxCount: 10,
      } as any)
      mockTx.whatsappMonthlyCount.update.mockResolvedValueOnce({
        id: "count-1",
        messageOutboxCount: 11,
      } as any)

      await expect(quotaService.deductQuota("org-1")).rejects.toThrow(
        InsufficientQuotaError
      )
    })

    it("allows send when count equals limit (within quota)", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: 10,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValueOnce({
        id: "count-1",
        messageOutboxCount: 9,
      } as any)
      mockTx.whatsappMonthlyCount.update.mockResolvedValueOnce({
        id: "count-1",
        messageOutboxCount: 10,
      } as any)

      await expect(quotaService.deductQuota("org-1")).resolves.toBeUndefined()
    })

    it("allows send when limit is 0 (unlimited)", async () => {
      mockTx.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        quotaBaseOut: 0,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValueOnce({
        id: "count-1",
        messageOutboxCount: 1000,
      } as any)
      mockTx.whatsappMonthlyCount.update.mockResolvedValueOnce({
        id: "count-1",
        messageOutboxCount: 1001,
      } as any)

      await expect(quotaService.deductQuota("org-1")).resolves.toBeUndefined()
    })
  })

  describe("getMonthlyStats", () => {
    it("returns inbox and outbox counts", async () => {
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValueOnce({
        messageInboxCount: 25,
        messageOutboxCount: 50,
      } as any)

      const result = await quotaService.getMonthlyStats("org-1")

      expect(result).toEqual({ inCount: 25, outCount: 50 })
    })

    it("returns zeros when no monthly count", async () => {
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValueOnce(null)

      const result = await quotaService.getMonthlyStats("org-1")

      expect(result).toEqual({ inCount: 0, outCount: 0 })
    })

    it("filters by deviceId", async () => {
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValueOnce(null)

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