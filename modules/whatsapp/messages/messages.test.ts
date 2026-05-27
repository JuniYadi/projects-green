import { describe, it, expect, beforeEach, vi } from "bun:test"
import { messageService } from "./messages.service"
import { quotaService, InsufficientQuotaError } from "./quota.service"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

const mockDevice = {
  id: "device-1",
  organizationId: "org-1",
  quotaBaseOut: 1000,
  tokenEncrypted: "encrypted-token",
  whatsappPhoneId: "phone-id",
  whatsappBusinessAccountId: "waba-id",
}

const mockConversation = {
  id: "conv-1",
  organizationId: "org-1",
  contactPhone: "+1234567890",
}

const mockMonthlyCount = {
  organizationId: "org-1",
  year: 2026,
  month: 5,
  messageOutboxCount: 250,
  messageInboxCount: 100,
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findFirst: vi.fn(),
    },
    whatsappConversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    whatsappMessage: {
      create: vi.fn(),
    },
    whatsappBroadcastCampaign: {
      create: vi.fn(),
    },
    whatsappBroadcastRecipient: {
      create: vi.fn(),
    },
    whatsappMonthlyCount: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/queue/whatsapp-broadcast", () => ({
  enqueueWhatsAppBroadcast: vi.fn().mockResolvedValue(undefined),
}))

describe("quotaService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("checkQuota", () => {
    it("should return quota info when device exists", async () => {
      const mockDeviceVal = mockDevice as Prisma.WhatsappDeviceGetPayload<Record<string, never>>
      const mockMonthlyCountVal = mockMonthlyCount as Prisma.WhatsappMonthlyCountGetPayload<Record<string, never>>
      ;(prisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockDeviceVal)
      ;(prisma.whatsappMonthlyCount.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockMonthlyCountVal)

      const result = await quotaService.checkQuota("org-1", "device-1")

      expect(result.hasQuota).toBe(true)
      expect(result.monthlyLimit).toBe(1000)
      expect(result.currentCount).toBe(250)
      expect(result.remaining).toBe(750)
    })

    it("should return hasQuota false when quota exceeded", async () => {
      const exceededCount = { ...mockMonthlyCount, messageOutboxCount: 101 }
      const deviceWithLimit = { ...mockDevice, quotaBaseOut: 100 } as Prisma.WhatsappDeviceGetPayload<Record<string, never>>
      const exceededCountVal = exceededCount as Prisma.WhatsappMonthlyCountGetPayload<Record<string, never>>
      ;(prisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(deviceWithLimit)
      ;(prisma.whatsappMonthlyCount.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(exceededCountVal)

      const result = await quotaService.checkQuota("org-1", "device-1")

      expect(result.hasQuota).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it("should return zero limit when no device found", async () => {
      ;(prisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      ;(prisma.whatsappMonthlyCount.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(false)
      expect(result.monthlyLimit).toBe(0)
      expect(result.remaining).toBe(0)
    })
  })

  describe("getMonthlyStats", () => {
    it("should return monthly stats", async () => {
      const mockMonthlyCountVal = mockMonthlyCount as Prisma.WhatsappMonthlyCountGetPayload<Record<string, never>>
      ;(prisma.whatsappMonthlyCount.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockMonthlyCountVal)

      const result = await quotaService.getMonthlyStats("org-1")

      expect(result.inCount).toBe(100)
      expect(result.outCount).toBe(250)
    })

    it("should return zeros when no monthly count exists", async () => {
      ;(prisma.whatsappMonthlyCount.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await quotaService.getMonthlyStats("org-1")

      expect(result.inCount).toBe(0)
      expect(result.outCount).toBe(0)
    })
  })
})

describe("messageService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getOrCreateConversation", () => {
    it("should return existing conversation", async () => {
      const mockConvVal = mockConversation as Prisma.WhatsappConversationGetPayload<Record<string, never>>
      ;(prisma.whatsappConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockConvVal)

      const result = await messageService.getOrCreateConversation("org-1", "+1234567890")

      expect(result).toBe("conv-1")
      expect(prisma.whatsappConversation.create).not.toHaveBeenCalled()
    })

    it("should create new conversation when not exists", async () => {
      const newConv = { ...mockConversation, id: "conv-new" }
      const newConvVal = newConv as Prisma.WhatsappConversationGetPayload<Record<string, never>>
      ;(prisma.whatsappConversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
      ;(prisma.whatsappConversation.create as ReturnType<typeof vi.fn>).mockResolvedValue(newConvVal)

      const result = await messageService.getOrCreateConversation("org-1", "+1234567890")

      expect(result).toBe("conv-new")
      expect(prisma.whatsappConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: "org-1",
          contactPhone: "+1234567890",
        }),
      })
    })
  })

  describe("sendMessage", () => {
    it("should throw InsufficientQuotaError when no quota available", async () => {
      const deviceWithLimit = { ...mockDevice, quotaBaseOut: 100 } as Prisma.WhatsappDeviceGetPayload<Record<string, never>>
      const monthlyVal = { messageOutboxCount: 100 } as Prisma.WhatsappMonthlyCountGetPayload<Record<string, never>>
      ;(prisma.whatsappDevice.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(deviceWithLimit)
      ;(prisma.whatsappMonthlyCount.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(monthlyVal)

      await expect(
        messageService.sendMessage({
          organizationId: "org-1",
          phoneNumber: "+1234567890",
          message: "Hello",
        })
      ).rejects.toThrow(InsufficientQuotaError)
    })
  })
})

describe("InsufficientQuotaError", () => {
  it("should have correct name and message", () => {
    const error = new InsufficientQuotaError("Test quota error")
    expect(error.name).toBe("InsufficientQuotaError")
    expect(error.message).toBe("Test quota error")
  })
})