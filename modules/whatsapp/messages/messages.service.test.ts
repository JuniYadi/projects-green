import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// ---------------------------------------------------------------------------
// Mock dependencies at the module level BEFORE any service imports.
// IMPORTANT: We intentionally do NOT mock "@/modules/whatsapp/messages/quota.service"
// here. Mocking that module would pollute the shared Bun module cache and
// cause quota.service.test.ts (which tests the real implementation) to receive
// the mock instead of the real service. Instead we mock @/lib/prisma at a
// level that allows the real quota service to behave as needed per test.
// ---------------------------------------------------------------------------

// Shared mock infrastructure for WhatsappBillingService
// Uses a simple object trick to allow per-test reconfiguration
const mockWhatsappBilling = {
  consumeAllowanceOrChargeOverage: mock(async (): Promise<
    | { kind: "ALLOWANCE"; remainingAllowance: number }
    | { kind: "OVERAGE_CHARGED"; charged: any; adjustmentId: string }
  > => ({ kind: "ALLOWANCE", remainingAllowance: 999 })),
  restoreAllowance: mock(async () => {}),
}

mock.module("@/modules/whatsapp/billing/whatsapp-billing.service", () => ({
  WhatsappBillingService: class {
    readonly consumeAllowanceOrChargeOverage =
      mockWhatsappBilling.consumeAllowanceOrChargeOverage
    readonly restoreAllowance = mockWhatsappBilling.restoreAllowance
  },
}))

mock.module("@/modules/billing/billing-transaction.service", () => ({
  BillingTransactionService: class {
    constructor() {}
    creditBalance = mock(async () => ({ alreadyProcessed: false }))
    debitBalance = mock(async () => ({ alreadyProcessed: false }))
    debitServiceBalance = mock(async () => ({ alreadyProcessed: false }))
  },
}))

const mockTx = {
  whatsappDevice: {
    findFirst: mock(async () => null),
  },
  whatsappDailyCount: {
    findUnique: mock(async () => null),
    upsert: mock(async () => ({ id: "daily-1" })),
  },
  whatsappMonthlyCount: {
    findFirst: mock(async () => null),
    findUnique: mock(async () => null),
    create: mock(async () => ({ id: "count-1", messageOutboxCount: 1 })),
    update: mock(async () => ({ id: "count-1", messageOutboxCount: 1 })),
    upsert: mock(async () => ({ id: "monthly-1" })),
  },
  billingAccount: {
    findUnique: mock(async () => ({
      id: "ba-1",
      balance: { toFixed: () => "100000", gte: () => true, gt: () => true, minus: () => ({ toFixed: () => "99950", lt: () => false, gt: () => false }) },
    })),
    update: mock(async () => ({ id: "ba-1", balance: { toFixed: () => "99950" } })),
  },
  billingAdjustment: {
    create: mock(async () => ({ id: "adj-1" })),
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
  pricing: {
    findFirst: mock(async () => null),
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
    mockPrisma.pricing.findFirst.mockClear()
    mockPrisma.usageLedger.create.mockClear()
    mockPrisma.$transaction.mockClear()
    mockTx.whatsappDevice.findFirst.mockClear()
    mockTx.whatsappDailyCount.findUnique.mockClear()
    mockTx.whatsappDailyCount.upsert.mockClear()
    mockTx.whatsappMonthlyCount.findFirst.mockClear()
    mockTx.whatsappMonthlyCount.create.mockClear()
    mockTx.whatsappMonthlyCount.update.mockClear()
    mockTx.whatsappMonthlyCount.upsert.mockClear()
    mockTx.billingAccount.findUnique.mockClear()
    mockTx.billingAccount.update.mockClear()
    mockTx.billingAdjustment.create.mockClear()
    mockWhatsappBilling.consumeAllowanceOrChargeOverage.mockClear()
    mockWhatsappBilling.restoreAllowance.mockClear()
    mockWhatsappBilling.consumeAllowanceOrChargeOverage.mockImplementation(
      async () => ({ kind: "ALLOWANCE", remainingAllowance: 999 } as const),
    )
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
    mockTx.billingAccount.findUnique.mockResolvedValue({
      id: "ba-1",
      balance: { toFixed: () => "100000", gte: () => true, gt: () => true, minus: () => ({ toFixed: () => "99950", lt: () => false, gt: () => false }) },
    } as any)
    mockTx.billingAccount.update.mockResolvedValue({
      id: "ba-1",
      balance: { toFixed: () => "99950" },
    } as any)
    mockTx.billingAdjustment.create.mockResolvedValue({
      id: "adj-1",
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

    it("throws InsufficientBalanceError when allowance exhausted and balance is insufficient", async () => {
      // Simulate allowance exhausted + overage fails due to insufficient balance
      mockWhatsappBilling.consumeAllowanceOrChargeOverage.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE"),
      )

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

    it("calls WhatsApp billing allowance check before Meta API", async () => {
      await sendMessageTestHelper({ organizationId: "org-1", deviceId: "device-1" })

      // Verify billing was checked before the Meta API call
      expect(mockWhatsappBilling.consumeAllowanceOrChargeOverage).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          deviceId: "device-1",
          messageCount: 1,
        }),
      )
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

    // ── WhatsApp Billing Integration Tests ────────────────────────────────

    it("sends message within allowance (no balance change)", async () => {
      // Default mock returns ALLOWANCE — no balance charge
      mockWhatsappBilling.consumeAllowanceOrChargeOverage.mockResolvedValue({
        kind: "ALLOWANCE",
        remainingAllowance: 999,
      })

      const result = await sendMessageTestHelper()

      expect(result.status).toBe("sent")
      expect(result.waMessageId).toBe("wa-msg-123")
      // Meta API was called (billing didn't block it)
      expect(mockDeviceClient.sendMessage).toHaveBeenCalled()
    })

    it("sends message after overage charge succeeds", async () => {
      // Simulate allowance exhausted — overage charged
      mockWhatsappBilling.consumeAllowanceOrChargeOverage.mockResolvedValue({
        kind: "OVERAGE_CHARGED",
        charged: { toString: () => "10" } as any,
        adjustmentId: "adj-over-1",
      })

      const result = await sendMessageTestHelper()

      expect(result.status).toBe("sent")
      expect(mockDeviceClient.sendMessage).toHaveBeenCalled()
    })

    it("does not call Meta API when overage balance is insufficient", async () => {
      // Simulate allowance exhausted + insufficient balance
      mockWhatsappBilling.consumeAllowanceOrChargeOverage.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE"),
      )

      await expect(sendMessageTestHelper()).rejects.toThrow("Insufficient balance")

      // Meta API should NOT be called — billing rejection happens before external call
      expect(mockDeviceClient.sendMessage).not.toHaveBeenCalled()
    })

    it("returns INSUFFICIENT_BALANCE error message for overage reject", async () => {
      mockWhatsappBilling.consumeAllowanceOrChargeOverage.mockRejectedValue(
        new Error("INSUFFICIENT_BALANCE"),
      )

      try {
        await sendMessageTestHelper()
        // Should not reach here
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toContain("Insufficient balance")
      }
    })

    it("restores allowance when Meta API fails after allowance was consumed", async () => {
      mockWhatsappBilling.consumeAllowanceOrChargeOverage.mockResolvedValue({
        kind: "ALLOWANCE",
        remainingAllowance: 999,
      })
      mockDeviceClient.sendMessage.mockRejectedValue(new Error("API Error"))

      await sendMessageTestHelper()

      expect(mockWhatsappBilling.restoreAllowance).toHaveBeenCalledWith(
        "device-1",
        1,
      )
    })

    it("logs warning but does not restore balance when overage charged + Meta API fails", async () => {
      const consoleWarnSpy = mock(() => {})
      const origWarn = console.warn
      console.warn = consoleWarnSpy

      mockWhatsappBilling.consumeAllowanceOrChargeOverage.mockResolvedValue({
        kind: "OVERAGE_CHARGED",
        charged: { toString: () => "10" } as any,
        adjustmentId: "adj-over-1",
      })
      mockDeviceClient.sendMessage.mockRejectedValue(new Error("API Error"))

      await sendMessageTestHelper()

      // restoreAllowance should NOT be called for overage
      expect(mockWhatsappBilling.restoreAllowance).not.toHaveBeenCalled()
      // But a warning should be logged
      expect(consoleWarnSpy).toHaveBeenCalled()

      console.warn = origWarn
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