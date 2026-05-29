import { describe, expect, it, vi, beforeEach } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import { QuotaGateService } from "./quota-gate.service"
import {
  QuotaExceededError,
  DailyLimitExceededError,
  DeviceNotFoundError,
  OrganizationNotMappedError,
  SubscriptionNotFoundError,
} from "./types"

// Properly typed mock Prisma client
interface MockedPrisma {
  billingAccount: { findUnique: ReturnType<typeof vi.fn> }
  subscription: { findFirst: ReturnType<typeof vi.fn> }
  whatsappDevice: {
    findFirst: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
  whatsappDailyCount: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
  whatsappMonthlyCount: {
    findUnique: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
  $transaction: ReturnType<typeof vi.fn>
}

const createMockPrisma = (): MockedPrisma => ({
  billingAccount: { findUnique: vi.fn() },
  subscription: { findFirst: vi.fn() },
  whatsappDevice: { findFirst: vi.fn(), findMany: vi.fn() },
  whatsappDailyCount: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  whatsappMonthlyCount: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
})

// Shared mock data
const mockBillingAccount = { id: "acc-1", tenantId: "tenant-1" }

const mockSubscription = {
  id: "sub-1",
  tenantId: "tenant-1",
  status: "ACTIVE",
  planId: "plan-whatsapp",
  plan: {
    code: "WHATSAPP_STANDARD",
    resources: { quotaIn: 1000, quotaOut: 500, dailyPerDevice: 100, devices: 5 },
  },
}

const mockUnlimitedSubscription = {
  id: "sub-2",
  tenantId: "tenant-1",
  status: "ACTIVE",
  planId: "plan-enterprise",
  plan: {
    code: "WHATSAPP_ENTERPRISE",
    resources: { quotaIn: null, quotaOut: null, dailyPerDevice: null, devices: null },
  },
}

const mockDevice = { id: "device-1", organizationId: "org-1" }

describe("QuotaGateService", () => {
  let service: QuotaGateService
  let mockPrisma: MockedPrisma

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = createMockPrisma()
    service = new QuotaGateService(mockPrisma as unknown as PrismaClient)

    // $transaction passes the mock as tx to the callback
    ;(mockPrisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (callback: (tx: MockedPrisma) => Promise<any>) => {
        return callback(mockPrisma)
      },
    )
  })

  describe("checkMessageQuota", () => {
    it("allows when under monthly limit", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockDevice,
      )
      ;(mockPrisma.whatsappDailyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 50,
        messageOutboxCount: 30,
      })
      ;(mockPrisma.whatsappMonthlyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 500,
        messageOutboxCount: 200,
      })

      const result = await service.checkMessageQuota("org-1", "device-1", "OUT")

      expect(result.allowed).toBe(true)
      expect(result.monthlyUsed).toBe(200)
      expect(result.monthlyLimit).toBe(500)
      expect(result.dailyUsed).toBe(30)
      expect(result.dailyLimit).toBe(100)
    })

    it("blocks when monthly limit exceeded", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockDevice,
      )
      ;(mockPrisma.whatsappDailyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 0,
        messageOutboxCount: 0,
      })
      ;(mockPrisma.whatsappMonthlyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 0,
        messageOutboxCount: 500,
      })

      const result = await service.checkMessageQuota("org-1", "device-1", "OUT")

      expect(result.allowed).toBe(false)
    })

    it("allows with unlimited plan (null quotas)", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockUnlimitedSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockDevice,
      )
      ;(mockPrisma.whatsappDailyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
      ;(mockPrisma.whatsappMonthlyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const result = await service.checkMessageQuota("org-1", "device-1", "OUT")

      expect(result.allowed).toBe(true)
      expect(result.monthlyLimit).toBe(null)
      expect(result.dailyLimit).toBe(null)
    })

    it("throws OrganizationNotMappedError when no billing account", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      await expect(
        service.checkMessageQuota("unknown-org", "device-1", "OUT"),
      ).rejects.toThrow(OrganizationNotMappedError)
    })

    it("throws SubscriptionNotFoundError when no active WhatsApp subscription", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      await expect(
        service.checkMessageQuota("org-1", "device-1", "OUT"),
      ).rejects.toThrow(SubscriptionNotFoundError)
    })

    it("throws DeviceNotFoundError when device not found", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      await expect(
        service.checkMessageQuota("org-1", "unknown-device", "OUT"),
      ).rejects.toThrow(DeviceNotFoundError)
    })

    it("respects dailyPerDevice limit", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockDevice,
      )
      ;(mockPrisma.whatsappDailyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 0,
        messageOutboxCount: 100,
      })
      ;(mockPrisma.whatsappMonthlyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const result = await service.checkMessageQuota("org-1", "device-1", "OUT")

      expect(result.allowed).toBe(false)
    })

    it("handles IN direction with messageInboxCount", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockDevice,
      )
      ;(mockPrisma.whatsappDailyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 20,
        messageOutboxCount: 0,
      })
      ;(mockPrisma.whatsappMonthlyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 200,
        messageOutboxCount: 0,
      })

      const result = await service.checkMessageQuota("org-1", "device-1", "IN")

      expect(result.allowed).toBe(true)
      expect(result.dailyUsed).toBe(20)
      expect(result.monthlyUsed).toBe(200)
      expect(result.monthlyLimit).toBe(1000)
    })
  })

  describe("deductMessageQuota", () => {
    it("creates new daily/monthly counts when none exist", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockDevice,
      )
      ;(mockPrisma.whatsappDailyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
      ;(mockPrisma.whatsappMonthlyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
      ;(mockPrisma.whatsappDailyCount.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "daily-1",
      })
      ;(mockPrisma.whatsappMonthlyCount.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "monthly-1",
      })

      const result = await service.deductMessageQuota("org-1", "device-1", "OUT")

      expect(result.allowed).toBe(true)
      expect(mockPrisma.whatsappDailyCount.upsert).toHaveBeenCalled()
      expect(mockPrisma.whatsappMonthlyCount.upsert).toHaveBeenCalled()
    })

    it("throws QuotaExceededError when monthly limit would be exceeded", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockDevice,
      )
      ;(mockPrisma.whatsappDailyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
      ;(mockPrisma.whatsappMonthlyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 0,
        messageOutboxCount: 500,
      })

      await expect(
        service.deductMessageQuota("org-1", "device-1", "OUT"),
      ).rejects.toThrow(QuotaExceededError)
    })

    it("throws DailyLimitExceededError when daily limit would be exceeded", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockDevice,
      )
      ;(mockPrisma.whatsappDailyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 0,
        messageOutboxCount: 100,
      })
      ;(mockPrisma.whatsappMonthlyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      await expect(
        service.deductMessageQuota("org-1", "device-1", "OUT"),
      ).rejects.toThrow(DailyLimitExceededError)
    })

    it("increments existing counts atomically", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockDevice,
      )
      ;(mockPrisma.whatsappDailyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 10,
        messageOutboxCount: 20,
      })
      ;(mockPrisma.whatsappMonthlyCount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        messageInboxCount: 100,
        messageOutboxCount: 200,
      })
      ;(mockPrisma.whatsappDailyCount.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "daily-1",
      })
      ;(mockPrisma.whatsappMonthlyCount.upsert as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "monthly-1",
      })

      const result = await service.deductMessageQuota("org-1", "device-1", "OUT")

      expect(result.allowed).toBe(true)
      expect(result.dailyUsed).toBe(21)
      expect(result.monthlyUsed).toBe(201)
      expect(mockPrisma.whatsappDailyCount.upsert).toHaveBeenCalled()
      expect(mockPrisma.whatsappMonthlyCount.upsert).toHaveBeenCalled()
    })
  })

  describe("getQuotaStatus", () => {
    it("returns results for all devices in org", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        mockDevice,
        { id: "device-2", organizationId: "org-1" },
      ])
      ;(mockPrisma.whatsappDailyCount.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])
      ;(mockPrisma.whatsappMonthlyCount.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

      const results = await service.getQuotaStatus("org-1")

      expect(results).toHaveLength(4)
    })

    it("throws DeviceNotFoundError when deviceId provided but not found", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockBillingAccount,
      )
      ;(mockPrisma.subscription.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockSubscription,
      )
      ;(mockPrisma.whatsappDevice.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([])

      await expect(service.getQuotaStatus("org-1", "unknown-device")).rejects.toThrow(
        DeviceNotFoundError,
      )
    })
  })
})
