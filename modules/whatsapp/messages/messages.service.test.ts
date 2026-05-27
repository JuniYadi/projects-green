import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// Mock dependencies before importing
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
    create: mock(async () => ({ id: "camp-1" })),
  },
  whatsappBroadcastRecipient: {
    create: mock(async () => ({ id: "recip-1" })),
  },
}

const mockQuotaService = {
  checkQuota: mock(async () => ({ hasQuota: true, remaining: 10 })),
  deductQuota: mock(async () => {}),
}

const mockDeviceClient = {
  sendMessage: mock(async () => ({ providerMessageId: "wa-msg-123" })),
}

const mockEnqueue = mock(async () => {})

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("./quota.service", () => ({
  quotaService: mockQuotaService,
  InsufficientQuotaError: class InsufficientQuotaError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "InsufficientQuotaError"
    }
  },
}))

mock.module("@/lib/whatsapp/meta-cloud/device-client", () => ({
  WhatsAppDeviceClient: {
    fromDevice: mock(async () => mockDeviceClient),
  },
}))

mock.module("@/lib/queue/whatsapp-broadcast", () => ({
  enqueueWhatsAppBroadcast: mockEnqueue,
}))

// Import after mocks
const { messageService } = await import("./messages.service")

describe("messageService", () => {
  beforeEach(() => {
    mockPrisma.whatsappDevice.findFirst.mockReset()
    mockPrisma.whatsappConversation.findFirst.mockReset()
    mockPrisma.whatsappConversation.create.mockReset()
    mockPrisma.whatsappMessage.create.mockReset()
    mockPrisma.whatsappBroadcastCampaign.create.mockReset()
    mockPrisma.whatsappBroadcastRecipient.create.mockReset()
    mockQuotaService.checkQuota.mockReset()
    mockQuotaService.deductQuota.mockReset()
    mockDeviceClient.sendMessage.mockReset()
    mockEnqueue.mockReset()

    // Default mock implementations
    mockQuotaService.checkQuota.mockResolvedValue({ hasQuota: true, remaining: 10 })
    mockQuotaService.deductQuota.mockResolvedValue(undefined)
    mockDeviceClient.sendMessage.mockResolvedValue({ providerMessageId: "wa-msg-123" })
    mockPrisma.whatsappDevice.findFirst.mockResolvedValue({
      id: "device-1",
      tokenEncrypted: "encrypted-token",
      whatsappPhoneId: "phone-id-1",
      whatsappBusinessAccountId: "waba-1",
    } as any)
    mockPrisma.whatsappConversation.findFirst.mockResolvedValue(null)
    mockPrisma.whatsappConversation.create.mockResolvedValue({ id: "conv-1" } as any)
    mockPrisma.whatsappMessage.create.mockResolvedValue({ id: "msg-1" } as any)
    mockPrisma.whatsappBroadcastCampaign.create.mockResolvedValue({ id: "camp-1" } as any)
    mockPrisma.whatsappBroadcastRecipient.create.mockResolvedValue({ id: "recip-1" } as any)
    mockEnqueue.mockResolvedValue(undefined)
  })

  describe("sendMessage", () => {
    it("sends message and returns result with waMessageId", async () => {
      const result = await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Hello world",
      })

      expect(result).toHaveProperty("jobId")
      expect(result).toHaveProperty("messageId")
      expect(result.waMessageId).toBe("wa-msg-123")
      expect(result.status).toBe("sent")
    })

    it("checks quota before sending", async () => {
      await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
      })

      expect(mockQuotaService.checkQuota).toHaveBeenCalledWith("org-1", undefined)
    })

    it("throws InsufficientQuotaError when no quota", async () => {
      mockQuotaService.checkQuota.mockResolvedValue({ hasQuota: false, remaining: 0 })

      await expect(
        messageService.sendMessage({
          organizationId: "org-1",
          phoneNumber: "+1234567890",
          message: "Test",
        })
      ).rejects.toThrow("Insufficient quota")
    })

    it("throws when no device found", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue(null)

      await expect(
        messageService.sendMessage({
          organizationId: "org-1",
          phoneNumber: "+1234567890",
          message: "Test",
        })
      ).rejects.toThrow("WhatsApp device not found")
    })

    it("deducts quota after sending", async () => {
      await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
        deviceId: "device-1",
      })

      expect(mockQuotaService.deductQuota).toHaveBeenCalledWith("org-1", "device-1")
    })

    it("creates message record in database", async () => {
      await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Hello",
      })

      expect(mockPrisma.whatsappMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: "OUTBOX",
            messageType: "text",
            body: "Hello",
          }),
        })
      )
    })

    it("creates broadcast campaign", async () => {
      await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
      })

      expect(mockPrisma.whatsappBroadcastCampaign.create).toHaveBeenCalled()
    })

    it("creates broadcast recipient", async () => {
      await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
      })

      expect(mockPrisma.whatsappBroadcastRecipient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phoneNumber: "+1234567890",
          }),
        })
      )
    })

    it("enqueues broadcast job", async () => {
      await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
      })

      expect(mockEnqueue).toHaveBeenCalledWith("camp-1", "", "dispatch")
    })

    it("sets status to queued when Meta API fails", async () => {
      mockDeviceClient.sendMessage.mockRejectedValue(new Error("API Error"))

      const result = await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
      })

      expect(result.status).toBe("queued")
      expect(result.waMessageId).toBeUndefined()
    })

    it("creates conversation if not exists", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue(null)

      await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
      })

      expect(mockPrisma.whatsappConversation.create).toHaveBeenCalled()
    })

    it("uses existing conversation if found", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue({
        id: "existing-conv",
      } as any)

      await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
      })

      expect(mockPrisma.whatsappConversation.create).not.toHaveBeenCalled()
    })

    it("uses specific device when deviceId provided", async () => {
      await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
        deviceId: "my-device",
      })

      expect(mockPrisma.whatsappDevice.findFirst).toHaveBeenCalledWith({
        where: { id: "my-device", organizationId: "org-1" },
      })
    })

    it("continues when quota deduction fails (non-quota error)", async () => {
      mockQuotaService.deductQuota.mockRejectedValue(new Error("DB error"))

      // Should not throw, message should still be sent
      const result = await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        message: "Test",
      })

      expect(result).toHaveProperty("jobId")
    })

    it("throws when quota deduction fails with InsufficientQuotaError", async () => {
      mockQuotaService.deductQuota.mockRejectedValue(
        new (await import("./quota.service")).InsufficientQuotaError("quota exceeded")
      )

      await expect(
        messageService.sendMessage({
          organizationId: "org-1",
          phoneNumber: "+1234567890",
          message: "Test",
        })
      ).rejects.toThrow("quota exceeded")
    })
  })

  describe("getOrCreateConversation", () => {
    it("returns existing conversation id", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce({
        id: "existing-conv",
      } as any)

      const id = await messageService.getOrCreateConversation(
        "org-1",
        "+1234567890"
      )

      expect(id).toBe("existing-conv")
      expect(mockPrisma.whatsappConversation.create).not.toHaveBeenCalled()
    })

    it("creates new conversation when not found", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce(null)
      mockPrisma.whatsappConversation.create.mockResolvedValueOnce({
        id: "new-conv",
      } as any)

      const id = await messageService.getOrCreateConversation(
        "org-1",
        "+1234567890"
      )

      expect(id).toBe("new-conv")
      expect(mockPrisma.whatsappConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: "org-1",
          contactPhone: "+1234567890",
          lastDirection: "OUTBOX",
        }),
      })
    })

    it("passes deviceId to conversation", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce(null)
      mockPrisma.whatsappConversation.create.mockResolvedValueOnce({
        id: "new-conv",
      } as any)

      await messageService.getOrCreateConversation(
        "org-1",
        "+1234567890",
        "device-1"
      )

      expect(mockPrisma.whatsappConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          whatsappDeviceId: "device-1",
        }),
      })
    })
  })
})