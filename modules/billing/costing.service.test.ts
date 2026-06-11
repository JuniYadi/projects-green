import { describe, it, expect, mock, beforeEach } from "bun:test"
import { PrismaClient } from "@prisma/client"
import { CostingService } from "./costing.service"

const mockPrisma = {
  serviceSubscription: {
    findUnique: mock(() => Promise.resolve(null)),
  },
  billingUsageLedger: {
    findMany: mock(() => Promise.resolve([])),
  },
}

describe("CostingService", () => {
  let service: CostingService

  beforeEach(() => {
    service = new CostingService(mockPrisma as unknown as PrismaClient)
    mockPrisma.serviceSubscription.findUnique.mockClear()
    mockPrisma.billingUsageLedger.findMany.mockClear()
  })

  describe("calculateWhatsAppCost", () => {
    it("should calculate cost based on message type and region", async () => {
      mockPrisma.serviceSubscription.findUnique.mockResolvedValue({
        id: "sub-1",
        pricingId: "pricing-1",
        pricing: {
          unitRateMessage: 0.05,
        },
      } as never)

      const result = await service.calculateWhatsAppCost({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        messageType: "TEXT",
        region: "ID",
        quantity: 100,
      })

      expect(result.totalCost.toNumber()).toBe(5)
      expect(result.category).toBe("whatsapp")
      expect(result.serviceType).toBe("WHATSAPP")
    })

    it("should return zero cost when pricing not found", async () => {
      mockPrisma.serviceSubscription.findUnique.mockResolvedValue(null)

      const result = await service.calculateWhatsAppCost({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        messageType: "TEXT",
        region: "ID",
        quantity: 100,
      })

      expect(result.totalCost.toNumber()).toBe(0)
      expect(result.unitPrice.toNumber()).toBe(0)
    })

    it("should return zero cost when unitRateMessage is null", async () => {
      mockPrisma.serviceSubscription.findUnique.mockResolvedValue({
        id: "sub-1",
        pricingId: "pricing-1",
        pricing: {
          unitRateMessage: null,
        },
      } as never)

      const result = await service.calculateWhatsAppCost({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        messageType: "TEXT",
        region: "ID",
        quantity: 100,
      })

      expect(result.totalCost.toNumber()).toBe(0)
    })
  })

  describe("calculateHostingCost", () => {
    it("should calculate cost based on vCPU hours", async () => {
      mockPrisma.serviceSubscription.findUnique.mockResolvedValue({
        id: "sub-1",
        pricingId: "pricing-1",
        pricing: {
          unitRateCpu: 0.10,
          unitRateMem: 0.05,
        },
      } as never)

      const result = await service.calculateHostingCost({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        vcpuHours: 24,
        memoryGbHours: 48,
        storageGbMonths: 10,
      })

      expect(result.totalCost.toNumber()).toBe(7.4)
      expect(result.category).toBe("hosting")
      expect(result.serviceType).toBe("APP_HOSTING")
    })

    it("should return zero cost when pricing not found", async () => {
      mockPrisma.serviceSubscription.findUnique.mockResolvedValue(null)

      const result = await service.calculateHostingCost({
        organizationId: "org-1",
        subscriptionId: "sub-1",
        vcpuHours: 24,
        memoryGbHours: 48,
        storageGbMonths: 10,
      })

      expect(result.totalCost.toNumber()).toBe(0)
    })
  })

  describe("getUsageBreakdown", () => {
    it("should return usage grouped by category", async () => {
      mockPrisma.billingUsageLedger.findMany.mockResolvedValue([
        { category: "whatsapp", amountIdr: 1000 },
        { category: "whatsapp", amountIdr: 2000 },
        { category: "hosting", amountIdr: 5000 },
      ] as never[])

      const result = await service.getUsageBreakdown("org-1", "2026-06")

      expect(result).toHaveLength(2)
      expect(result[0].category).toBe("hosting")
      expect(result[0].totalCost.toNumber()).toBe(5000)
      expect(result[0].percentage).toBeCloseTo(62.5)
      expect(result[1].category).toBe("whatsapp")
      expect(result[1].totalCost.toNumber()).toBe(3000)
      expect(result[1].percentage).toBeCloseTo(37.5)
    })

    it("should return empty array when no entries", async () => {
      mockPrisma.billingUsageLedger.findMany.mockResolvedValue([])

      const result = await service.getUsageBreakdown("org-1", "2026-06")

      expect(result).toHaveLength(0)
    })

    it("should handle null category as unknown", async () => {
      mockPrisma.billingUsageLedger.findMany.mockResolvedValue([
        { category: null, amountIdr: 1000 },
      ] as never[])

      const result = await service.getUsageBreakdown("org-1", "2026-06")

      expect(result).toHaveLength(1)
      expect(result[0].category).toBe("unknown")
    })
  })
})
