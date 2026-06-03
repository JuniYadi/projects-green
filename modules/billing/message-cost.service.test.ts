import { describe, expect, it, vi, beforeEach } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal
import { MessageCostService } from "./message-cost.service"

interface MockedPrisma {
  subscription: { findFirst: ReturnType<typeof vi.fn> }
  billingAccount: { findUnique: ReturnType<typeof vi.fn> }
  pricing: { findFirst: ReturnType<typeof vi.fn> }
}

const createMockPrisma = (): MockedPrisma => ({
  subscription: { findFirst: vi.fn() },
  billingAccount: { findUnique: vi.fn() },
  pricing: { findFirst: vi.fn() },
})

describe("MessageCostService", () => {
  let service: MessageCostService
  let mockPrisma: MockedPrisma

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    service = new MessageCostService(mockPrisma as unknown as PrismaClient)
  })

  describe("estimateMessageCost", () => {
    it("returns unitRateMessage from PAYG pricing", async () => {
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(mockPrisma.pricing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "price-1",
        planId: "plan-1",
        regionId: "reg-1",
        type: "PAYG",
        billingMode: "PAYG",
        basePriceIdr: new Decimal(0),
        monthlyCapIdr: null,
        unitRateCpu: null,
        unitRateMem: null,
        unitRateMessage: new Decimal(150),
        isActive: true,
        servicePlan: { code: "STANDARD", packageId: "WHATSAPP", resources: {} },
        region: { code: "GLOBAL" },
      })

      const cost = await service.estimateMessageCost({
        organizationId: "org-1",
        messageType: "text",
      })

      expect(cost.toNumber()).toBe(150)
    })

    it("returns 0 when no active WhatsApp subscription", async () => {
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const cost = await service.estimateMessageCost({
        organizationId: "org-1",
        messageType: "text",
      })

      expect(cost.toNumber()).toBe(0)
    })

    it("returns 0 when no PAYG pricing found", async () => {
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(mockPrisma.pricing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const cost = await service.estimateMessageCost({
        organizationId: "org-1",
        messageType: "text",
      })

      expect(cost.toNumber()).toBe(0)
    })

    it("returns 0 when plan has unlimited flag", async () => {
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        planId: "plan-1",
        plan: {
          resources: { unlimited: true },
        },
      })

      const cost = await service.estimateMessageCost({
        organizationId: "org-1",
        messageType: "text",
      })

      expect(cost.toNumber()).toBe(0)
    })
  })

  describe("checkBalanceForMessage", () => {
    it("returns sufficient=true when balance >= estimated cost", async () => {
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(mockPrisma.pricing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "price-1",
        planId: "plan-1",
        regionId: "reg-1",
        type: "PAYG",
        billingMode: "PAYG",
        basePriceIdr: new Decimal(0),
        monthlyCapIdr: null,
        unitRateCpu: null,
        unitRateMem: null,
        unitRateMessage: new Decimal(150),
        isActive: true,
        servicePlan: { code: "STANDARD", packageId: "WHATSAPP", resources: {} },
        region: { code: "GLOBAL" },
      })
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        balance: new Decimal(500),
      })

      const result = await service.checkBalanceForMessage({
        organizationId: "org-1",
        messageType: "text",
      })

      expect(result.sufficient).toBe(true)
      expect(result.required.toNumber()).toBe(150)
      expect(result.available.toNumber()).toBe(500)
    })

    it("returns sufficient=false when balance < estimated cost", async () => {
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(mockPrisma.pricing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "price-1",
        planId: "plan-1",
        regionId: "reg-1",
        type: "PAYG",
        billingMode: "PAYG",
        basePriceIdr: new Decimal(0),
        monthlyCapIdr: null,
        unitRateCpu: null,
        unitRateMem: null,
        unitRateMessage: new Decimal(300),
        isActive: true,
        servicePlan: { code: "STANDARD", packageId: "WHATSAPP", resources: {} },
        region: { code: "GLOBAL" },
      })
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        balance: new Decimal(100),
      })

      const result = await service.checkBalanceForMessage({
        organizationId: "org-1",
        messageType: "text",
      })

      expect(result.sufficient).toBe(false)
      expect(result.required.toNumber()).toBe(300)
      expect(result.available.toNumber()).toBe(100)
    })

    it("returns sufficient=false when no billing account exists", async () => {
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(mockPrisma.pricing.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "price-1",
        planId: "plan-1",
        regionId: "reg-1",
        type: "PAYG",
        billingMode: "PAYG",
        basePriceIdr: new Decimal(0),
        monthlyCapIdr: null,
        unitRateCpu: null,
        unitRateMem: null,
        unitRateMessage: new Decimal(150),
        isActive: true,
        servicePlan: { code: "STANDARD", packageId: "WHATSAPP", resources: {} },
        region: { code: "GLOBAL" },
      })
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const result = await service.checkBalanceForMessage({
        organizationId: "org-1",
        messageType: "text",
      })

      expect(result.sufficient).toBe(false)
      expect(result.required.toNumber()).toBe(150)
      expect(result.available.toNumber()).toBe(0)
    })
  })
})
