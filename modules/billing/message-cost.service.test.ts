import { describe, expect, it, vi, beforeEach } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import { Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal
import {
  MessageCostService,
  calculateTieredMessageCost,
} from "./message-cost.service"
interface MockedPrisma {
  serviceSubscription: { findFirst: ReturnType<typeof vi.fn> }
  billingAccount: { findUnique: ReturnType<typeof vi.fn> }
  servicePricing: { findFirst: ReturnType<typeof vi.fn> }
  whatsappBasePrice: { findFirst: ReturnType<typeof vi.fn> }
  whatsappDevice: { findUnique: ReturnType<typeof vi.fn> }
}

const createMockPrisma = (): MockedPrisma => ({
  serviceSubscription: { findFirst: vi.fn() },
  billingAccount: { findUnique: vi.fn() },
  servicePricing: { findFirst: vi.fn() },
  whatsappBasePrice: { findFirst: vi.fn() },
  whatsappDevice: { findUnique: vi.fn() },
})
describe("MessageCostService", () => {
  let service: MessageCostService
  let mockPrisma: MockedPrisma

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    service = new MessageCostService(mockPrisma as unknown as PrismaClient)
  })
  describe("calculateTieredMessageCost", () => {
    it("calculates correct fee, PPN, and total for Utility across all tiers", () => {
      // Base Rp 357
      // BASE (20%): fee 72, ppn 40, total 469
      const baseTier = calculateTieredMessageCost(357, "BASE")
      expect(baseTier.totalCharged.toString()).toBe("469")
      expect(baseTier.feeAmount.toString()).toBe("72")
      expect(baseTier.ppnAmount.toString()).toBe("40")

      // TIER_1 (15%): fee 54, ppn 40, total 451
      const tier1 = calculateTieredMessageCost(357, "TIER_1")
      expect(tier1.totalCharged.toString()).toBe("451")
      expect(tier1.feeAmount.toString()).toBe("54")
      expect(tier1.ppnAmount.toString()).toBe("40")

      // TIER_2 (10%): fee 36, ppn 40, total 433
      const tier2 = calculateTieredMessageCost(357, "TIER_2")
      expect(tier2.totalCharged.toString()).toBe("433")
      expect(tier2.feeAmount.toString()).toBe("36")
      expect(tier2.ppnAmount.toString()).toBe("40")

      // TIER_3 (5%): fee 18, ppn 40, total 415
      const tier3 = calculateTieredMessageCost(357, "TIER_3")
      expect(tier3.totalCharged.toString()).toBe("415")
      expect(tier3.feeAmount.toString()).toBe("18")
      expect(tier3.ppnAmount.toString()).toBe("40")
    })

    it("calculates correct fee, PPN, and total for Marketing (Base Rp 587)", () => {
      // BASE (20%): fee 118, ppn 65, total 770
      const baseTier = calculateTieredMessageCost(587, "BASE")
      expect(baseTier.totalCharged.toString()).toBe("770")
      expect(baseTier.feeAmount.toString()).toBe("118")
      expect(baseTier.ppnAmount.toString()).toBe("65")

      // TIER_3 (5%): fee 30 (ceil 29.35), ppn 65, total 682
      const tier3 = calculateTieredMessageCost(587, "TIER_3")
      expect(tier3.feeAmount.toString()).toBe("30")
      expect(tier3.ppnAmount.toString()).toBe("65")
      expect(tier3.totalCharged.toString()).toBe("682")
    })
  })

  describe("estimateMessageCost with WhatsappBasePrice", () => {
    it("returns calculated overage from effective WhatsappBasePrice and device rate tier", async () => {
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        rates: "TIER_1",
      })
      mockPrisma.whatsappBasePrice.findFirst.mockResolvedValue({
        basePrice: new Decimal(357),
        currency: "IDR",
      })

      const cost = await service.estimateMessageCost({
        organizationId: "org-1",
        messageType: "template",
        deviceId: "dev-1",
        category: "UTILITY",
      })

      expect(cost.toString()).toBe("451")
    })
  })

  describe("estimateMessageCost", () => {
    it("returns unitRateMessage from PAYG pricing", async () => {
      ;(
        mockPrisma.serviceSubscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(
        mockPrisma.servicePricing.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
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
      ;(
        mockPrisma.serviceSubscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null)

      const cost = await service.estimateMessageCost({
        organizationId: "org-1",
        messageType: "text",
      })

      expect(cost.toNumber()).toBe(0)
    })

    it("returns 0 when no PAYG pricing found", async () => {
      ;(
        mockPrisma.serviceSubscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(
        mockPrisma.servicePricing.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null)

      const cost = await service.estimateMessageCost({
        organizationId: "org-1",
        messageType: "text",
      })

      expect(cost.toNumber()).toBe(0)
    })

    it("returns 0 when plan has unlimited flag", async () => {
      ;(
        mockPrisma.serviceSubscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
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

  describe("getMessagePricing", () => {
    it("returns the configured unit price, currency, and status", async () => {
      ;(
        mockPrisma.serviceSubscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(
        mockPrisma.servicePricing.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        id: "price-1",
        planId: "plan-1",
        regionId: "reg-1",
        type: "PAYG",
        billingMode: "PAYG",
        currency: "IDR",
        basePriceIdr: new Decimal(0),
        monthlyCapIdr: null,
        unitRateCpu: null,
        unitRateMem: null,
        unitRateMessage: new Decimal(150),
        servicePlan: { code: "STANDARD", packageId: "WHATSAPP", resources: {} },
        region: { code: "GLOBAL" },
      })

      await expect(
        service.getMessagePricing({
          organizationId: "org-1",
          messageType: "template",
        })
      ).resolves.toEqual({
        unitPrice: new Decimal(150),
        currency: "IDR",
        configured: true,
      })
    })

    it("marks missing PAYG pricing as unconfigured", async () => {
      ;(
        mockPrisma.serviceSubscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(
        mockPrisma.servicePricing.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null)

      await expect(
        service.getMessagePricing({
          organizationId: "org-1",
          messageType: "template",
        })
      ).resolves.toEqual({
        unitPrice: null,
        currency: null,
        configured: false,
      })
    })
  })

  describe("checkBalanceForMessage", () => {
    it("returns sufficient=true when balance >= estimated cost", async () => {
      ;(
        mockPrisma.serviceSubscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(
        mockPrisma.servicePricing.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
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
      ;(
        mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
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
      ;(
        mockPrisma.serviceSubscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(
        mockPrisma.servicePricing.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
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
      ;(
        mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
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
      ;(
        mockPrisma.serviceSubscription.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
        planId: "plan-1",
        plan: { resources: {} },
      })
      ;(
        mockPrisma.servicePricing.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce({
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
      ;(
        mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null)

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
