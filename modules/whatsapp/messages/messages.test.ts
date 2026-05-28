import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockPrisma = {
  whatsappDevice: {
    findFirst: mock(async () => null),
  },
  whatsappConversation: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: "conv-1" })),
  },
  whatsappMessage: {
    create: mock(async () => ({ id: "msg-1" })),
  },
  whatsappBroadcastCampaign: {
    create: mock(async () => ({ id: "campaign-1" })),
  },
  whatsappBroadcastRecipient: {
    create: mock(async () => ({ id: "recipient-1" })),
  },
  whatsappMonthlyCount: {
    findFirst: mock(async () => null),
    upsert: mock(async () => ({ id: "count-1" })),
  },
  $transaction: mock(async (fn: any) => fn(mockPrisma)),
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/lib/queue/whatsapp-broadcast", () => ({
  enqueueWhatsAppBroadcast: mock(async () => undefined),
}))

// Import after mock
const { messageService } = await import("./messages.service")
const { quotaService, InsufficientQuotaError } = await import("./quota.service")

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

// Mock Date to a fixed point in time
const FIXED_DATE = new Date("2026-05-15T00:00:00Z")
const OriginalDate = global.Date
global.Date = class extends OriginalDate {
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(FIXED_DATE)
    } else {
      super(args[0])
    }
  }
} as any

describe("quotaService", () => {
  beforeEach(() => {
    mockPrisma.whatsappDevice.findFirst.mockReset()
    mockPrisma.whatsappMonthlyCount.findFirst.mockReset()
  })

  describe("checkQuota", () => {
    it("should return quota info when device exists", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue(mockDevice as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(mockMonthlyCount as any)

      const result = await quotaService.checkQuota("org-1", "device-1")

      expect(result.hasQuota).toBe(true)
      expect(result.monthlyLimit).toBe(1000)
      expect(result.currentCount).toBe(250)
      expect(result.remaining).toBe(750)
    })

    it("should return hasQuota false when quota exceeded", async () => {
      const exceededCount = { ...mockMonthlyCount, messageOutboxCount: 101 }
      const deviceWithLimit = { ...mockDevice, quotaBaseOut: 100 }
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue(deviceWithLimit as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(exceededCount as any)

      const result = await quotaService.checkQuota("org-1", "device-1")

      expect(result.hasQuota).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it("should return zero limit when no device found", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue(null)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(null)

      const result = await quotaService.checkQuota("org-1")

      expect(result.hasQuota).toBe(false)
      expect(result.monthlyLimit).toBe(0)
      expect(result.remaining).toBe(0)
    })
  })

  describe("getMonthlyStats", () => {
    it("should return monthly stats", async () => {
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(mockMonthlyCount as any)

      const result = await quotaService.getMonthlyStats("org-1")

      expect(result.inCount).toBe(100)
      expect(result.outCount).toBe(250)
    })

    it("should return zeros when no monthly count exists", async () => {
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(null)

      const result = await quotaService.getMonthlyStats("org-1")

      expect(result.inCount).toBe(0)
      expect(result.outCount).toBe(0)
    })
  })
})

describe("messageService", () => {
  beforeEach(() => {
    mockPrisma.whatsappConversation.findFirst.mockReset()
    mockPrisma.whatsappConversation.create.mockReset()
    mockPrisma.whatsappDevice.findFirst.mockReset()
    mockPrisma.whatsappMonthlyCount.findFirst.mockReset()

    // Default implementations to avoid undefined
    mockPrisma.whatsappConversation.create.mockResolvedValue({ id: "conv-1" } as any)
    mockPrisma.whatsappMessage.create.mockResolvedValue({ id: "msg-1" } as any)
    mockPrisma.whatsappBroadcastCampaign.create.mockResolvedValue({ id: "campaign-1" } as any)
    mockPrisma.whatsappBroadcastRecipient.create.mockResolvedValue({ id: "recipient-1" } as any)
    mockPrisma.whatsappMonthlyCount.upsert.mockResolvedValue({ id: "count-1" } as any)
  })

  describe("getOrCreateConversation", () => {
    it("should return existing conversation", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue(mockConversation as any)

      const result = await messageService.getOrCreateConversation("org-1", "+1234567890")

      expect(result).toBe("conv-1")
      expect(mockPrisma.whatsappConversation.create).not.toHaveBeenCalled()
    })

    it("should create new conversation when not exists", async () => {
      const newConv = { ...mockConversation, id: "conv-new" }
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue(null)
      mockPrisma.whatsappConversation.create.mockResolvedValue(newConv as any)

      const result = await messageService.getOrCreateConversation("org-1", "+1234567890")

      expect(result).toBe("conv-new")
      expect(mockPrisma.whatsappConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: "org-1",
          contactPhone: "+1234567890",
        }),
      })
    })
  })

  describe("sendMessage", () => {
    it("should throw InsufficientQuotaError when no quota available", async () => {
      const deviceWithLimit = { ...mockDevice, quotaBaseOut: 100 }
      const monthlyVal = { messageOutboxCount: 100 }
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue(deviceWithLimit as any)
      mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(monthlyVal as any)

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