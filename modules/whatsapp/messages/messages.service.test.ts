import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// ---------------------------------------------------------------------------
// Mock dependencies at the module level BEFORE any service imports.
// IMPORTANT: We intentionally do NOT mock "@/modules/whatsapp/messages/quota.service"
// here. Mocking that module would pollute the shared Bun module cache and
// cause quota.service.test.ts (which tests the real implementation) to receive
// the mock instead of the real service. Instead we mock @/lib/prisma at a
// level that allows the real quota service to behave as needed per test.
// ---------------------------------------------------------------------------

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
  whatsappMonthlyCount: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: "count-1", messageOutboxCount: 1 })),
    update: mock(async () => ({ id: "count-1", messageOutboxCount: 1 })),
  },
  billingAccount: {
    findUnique: mock(async () => ({
      id: "ba-1",
      organizationId: "tenant-1",
      balance: { toString: () => "100000" },
    })),
  },
  subscription: {
    findFirst: mock(async () => null),
    findUnique: mock(async () => null),
  },
  usageLedger: {
    create: mock(async () => ({ id: "ledger-1" })),
  },
  $transaction: mock(async (fn: any) => fn(mockTx)),
}

const mockDeviceClient = {
  sendMessage: mock(async () => ({ providerMessageId: "wa-msg-123" })),
}

const mockEnqueue = mock(async () => {})

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
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
const { InsufficientQuotaError } = await import("./quota.service")

// ---------------------------------------------------------------------------
// Default device fixture — quota: 1000 limit, count: 0 → hasQuota: true
// ---------------------------------------------------------------------------
const mockDevice = {
  id: "device-1",
  organizationId: "org-1",
  quotaBaseOut: 1000,
  tokenEncrypted: "encrypted-token",
  whatsappPhoneId: "phone-id-1",
  whatsappBusinessAccountId: "waba-1",
}

const sendMessageTestHelper = async (overrides: Record<string, any> = {}) => {
  return messageService.sendMessage({
    organizationId: "org-1",
    phoneNumber: "+1234567890",
    message: "Test message",
    ...overrides,
  })
}

describe("messageService", () => {
  beforeEach(() => {
    // Clear all mocks
    mockPrisma.whatsappDevice.findFirst.mockClear()
    mockPrisma.whatsappConversation.findFirst.mockClear()
    mockPrisma.whatsappConversation.create.mockClear()
    mockPrisma.whatsappMessage.create.mockClear()
    mockPrisma.whatsappBroadcastCampaign.create.mockClear()
    mockPrisma.whatsappBroadcastRecipient.create.mockClear()
    mockPrisma.whatsappMonthlyCount.findFirst.mockClear()
    mockPrisma.whatsappMonthlyCount.create.mockClear()
    mockPrisma.whatsappMonthlyCount.update.mockClear()
    mockPrisma.billingAccount.findUnique.mockClear()
    mockPrisma.subscription.findFirst.mockClear()
    mockPrisma.usageLedger.create.mockClear()
    mockPrisma.$transaction.mockClear()
    mockTx.whatsappDevice.findFirst.mockClear()
    mockTx.whatsappMonthlyCount.findFirst.mockClear()
    mockTx.whatsappMonthlyCount.create.mockClear()
    mockTx.whatsappMonthlyCount.update.mockClear()
    mockDeviceClient.sendMessage.mockClear()
    mockEnqueue.mockClear()

    // Default: device with quota 1000, no monthly usage → hasQuota: true
    // (quota service reads prisma.whatsappDevice + prisma.whatsappMonthlyCount)
    mockPrisma.whatsappDevice.findFirst.mockResolvedValue(mockDevice as any)
    mockPrisma.whatsappMonthlyCount.findFirst.mockResolvedValue(null) // 0 usage
    mockPrisma.whatsappConversation.findFirst.mockResolvedValue(null)
    mockPrisma.whatsappConversation.create.mockResolvedValue({
      id: "conv-1",
    } as any)
    mockPrisma.whatsappMessage.create.mockResolvedValue({ id: "msg-1" } as any)
    mockPrisma.whatsappBroadcastCampaign.create.mockResolvedValue({
      id: "camp-1",
    } as any)
    mockPrisma.whatsappBroadcastRecipient.create.mockResolvedValue({
      id: "recip-1",
    } as any)

    // Billing mocks - default with positive balance
    mockPrisma.billingAccount.findUnique.mockResolvedValue({
      id: "ba-1",
      organizationId: "tenant-1",
      balance: { toFixed: () => "100000", gte: () => true, gt: () => true },
    } as any)
    mockPrisma.subscription.findFirst.mockResolvedValue(null) // No subscription = no quota gate enforcement
    mockPrisma.usageLedger.create.mockResolvedValue({ id: "ledger-1" } as any)

    // $transaction passthrough
    mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockTx))

    // tx defaults: device found, no existing count → creates new count
    mockTx.whatsappDevice.findFirst.mockResolvedValue(mockDevice as any)
    mockTx.whatsappMonthlyCount.findFirst.mockResolvedValue(null)
    mockTx.whatsappMonthlyCount.create.mockResolvedValue({
      id: "count-1",
      messageOutboxCount: 1,
    } as any)
    mockTx.whatsappMonthlyCount.update.mockResolvedValue({
      id: "count-1",
      messageOutboxCount: 1,
    } as any)

    mockDeviceClient.sendMessage.mockResolvedValue({
      providerMessageId: "wa-msg-123",
    })
    mockEnqueue.mockResolvedValue(undefined)
  })

  describe("sendMessage", () => {
    it("sends message and returns result with waMessageId", async () => {
      const result = await sendMessageTestHelper({ message: "Hello world" })

      expect(result).toHaveProperty("jobId")
      expect(result).toHaveProperty("messageId")
      expect(result.waMessageId).toBe("wa-msg-123")
      expect(result.status).toBe("sent")
    })

    it("checks quota before sending", async () => {
      await sendMessageTestHelper({ organizationId: "org-1" })

      // The real quota service reads whatsappDevice — verify it was called
      expect(mockPrisma.whatsappDevice.findFirst).toHaveBeenCalled()
    })

    it("throws InsufficientBalanceError when balance is zero or negative", async () => {
      // With billing integration: if balance is 0, throws InsufficientBalanceError
      // Even with legacy quota available, balance check should fail first
      mockPrisma.billingAccount.findUnique.mockResolvedValue({
        id: "ba-1",
        organizationId: "tenant-1",
        balance: { toFixed: () => "0.00", gte: () => false, gt: () => false },
      } as any)
      // Reset subscription mock so we don't trigger quota gate
      mockPrisma.subscription.findFirst.mockResolvedValue(null)

      await expect(sendMessageTestHelper()).rejects.toThrow("Insufficient balance")
    })

    it("throws when no device found", async () => {
      // New flow: device check happens first, throws "WhatsApp device not found"
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue(null)

      await expect(sendMessageTestHelper()).rejects.toThrow("WhatsApp device not found")
    })

    it("deducts quota after sending", async () => {
      await sendMessageTestHelper({ organizationId: "org-1", deviceId: "device-1" })

      // Deduct quota goes through $transaction
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it("creates message record in database", async () => {
      await sendMessageTestHelper({ message: "Hello" })

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
      await sendMessageTestHelper()

      expect(mockPrisma.whatsappBroadcastCampaign.create).toHaveBeenCalled()
    })

    it("creates broadcast recipient", async () => {
      await sendMessageTestHelper({ phoneNumber: "+1234567890" })

      expect(mockPrisma.whatsappBroadcastRecipient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phoneNumber: "+1234567890",
          }),
        })
      )
    })

    it("enqueues broadcast job", async () => {
      await sendMessageTestHelper()

      expect(mockEnqueue).toHaveBeenCalledWith("camp-1", "", "dispatch")
    })

    it("sets status to queued when Meta API fails", async () => {
      mockDeviceClient.sendMessage.mockRejectedValue(new Error("API Error"))

      const result = await sendMessageTestHelper()

      expect(result.status).toBe("queued")
      expect(result.waMessageId).toBeUndefined()
    })

    it("creates conversation if not exists", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue(null)

      await sendMessageTestHelper()

      expect(mockPrisma.whatsappConversation.create).toHaveBeenCalled()
    })

    it("uses existing conversation if found", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue({
        id: "existing-conv",
      } as any)

      await sendMessageTestHelper()

      expect(mockPrisma.whatsappConversation.create).not.toHaveBeenCalled()
    })

    it("uses specific device when deviceId provided", async () => {
      await sendMessageTestHelper({
        organizationId: "org-1",
        deviceId: "my-device",
      })

      expect(mockPrisma.whatsappDevice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
          }),
        })
      )
    })

    it("continues when quota deduction fails (non-quota error)", async () => {
      // Make $transaction throw a generic error (not InsufficientQuotaError)
      mockPrisma.$transaction.mockRejectedValue(new Error("DB error"))

      // Should not throw — message still sent, quota deduction error is swallowed
      const result = await sendMessageTestHelper()

      expect(result).toHaveProperty("jobId")
    })

    it("throws when quota deduction fails with InsufficientQuotaError", async () => {
      // checkQuota passes (device with quota, no usage), but deductQuota ($transaction)
      // returns a count that exceeds the limit → throws InsufficientQuotaError
      mockTx.whatsappDevice.findFirst.mockResolvedValue({
        ...mockDevice,
        quotaBaseOut: 1,
      } as any)
      mockTx.whatsappMonthlyCount.findFirst.mockResolvedValue(null)
      mockTx.whatsappMonthlyCount.create.mockResolvedValue({
        id: "count-1",
        messageOutboxCount: 2, // > limit of 1 → throws
      } as any)

      await expect(sendMessageTestHelper()).rejects.toThrow(InsufficientQuotaError)
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