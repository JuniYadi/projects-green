import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// ---------------------------------------------------------------------------
// Mock dependencies at the module level BEFORE any service imports.
// IMPORTANT: We intentionally do NOT mock
//   @/modules/whatsapp/billing/whatsapp-billing.service  or
//   @/modules/billing/billing-transaction.service
// here. Mocking those modules would pollute the shared Bun module cache and
// cause the respective *.service.test.ts files to receive mocks instead of
// the real implementations. Instead we mock @/lib/prisma at a level that
// allows all real services to behave as needed per test.
//
// See AGENTS.md: test-guidelines > mock.module — Module Cache Rules
// ---------------------------------------------------------------------------

const mockTx = {
  whatsappDevice: {
    findFirst: mock(async () => null),
    findUnique: mock(async () => null),
    updateMany: mock(async () => ({ count: 1 })),
    update: mock(async () => null),
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
      balance: {
        toFixed: () => "100000",
        gte: () => true,
        gt: () => true,
        minus: () => ({
          toFixed: () => "99950",
          lt: () => false,
          gt: () => false,
        }),
      },
    })),
    update: mock(async () => ({
      id: "ba-1",
      balance: { toFixed: () => "99950" },
    })),
  },
  billingAdjustment: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: "adj-1" })),
  },
  billingInvoice: {
    findFirst: mock(async () => null),
    count: mock(async () => 0),
    create: mock(async () => ({
      id: "inv-1",
      status: "DRAFT",
      billingAccountId: "ba-1",
      currency: "IDR",
      periodStart: new Date("2026-06-01"),
      periodEnd: new Date("2026-06-30"),
    })),
    update: mock(async () => ({ id: "inv-1" })),
  },
  billingInvoiceLine: {
    create: mock(async () => ({ id: "line-1" })),
  },
}

const mockPrisma = {
  whatsappDevice: {
    findFirst: mock(async () => null),
    findUnique: mock(async () => null),
    updateMany: mock(async () => ({ count: 1 })),
    update: mock(async () => null),
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
  serviceSubscription: {
    findFirst: mock(async () => null),
    findUnique: mock(async () => null),
  },
  servicePricing: {
    findFirst: mock(async () => null),
  },
  billingUsageLedger: {
    create: mock(async () => ({ id: "ledger-1" })),
  },
  $transaction: mock(async (fn: any) => await fn(mockTx)),
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
  beforeEach(async () => {
    // Clear all mocks
    mockPrisma.whatsappDevice.findFirst.mockClear()
    mockPrisma.whatsappDevice.findUnique.mockClear()
    mockPrisma.whatsappDevice.updateMany.mockClear()
    mockPrisma.whatsappDevice.update.mockClear()
    mockPrisma.whatsappConversation.findFirst.mockClear()
    mockPrisma.whatsappConversation.create.mockClear()
    mockPrisma.whatsappMessage.create.mockClear()
    mockPrisma.whatsappBroadcastCampaign.create.mockClear()
    mockPrisma.whatsappBroadcastRecipient.create.mockClear()
    mockPrisma.whatsappMonthlyCount.findFirst.mockClear()
    mockPrisma.whatsappMonthlyCount.create.mockClear()
    mockPrisma.whatsappMonthlyCount.update.mockClear()
    mockPrisma.billingAccount.findUnique.mockClear()
    mockPrisma.serviceSubscription.findFirst.mockClear()
    mockPrisma.servicePricing.findFirst.mockClear()
    mockPrisma.billingUsageLedger.create.mockClear()
    mockPrisma.$transaction.mockClear()
    mockTx.whatsappDevice.findFirst.mockClear()
    mockTx.whatsappDevice.findUnique.mockClear()
    mockTx.whatsappDevice.updateMany.mockClear()
    mockTx.whatsappDevice.update.mockClear()
    mockTx.whatsappDailyCount.findUnique.mockClear()
    mockTx.whatsappDailyCount.upsert.mockClear()
    mockTx.whatsappMonthlyCount.findFirst.mockClear()
    mockTx.whatsappMonthlyCount.create.mockClear()
    mockTx.whatsappMonthlyCount.update.mockClear()
    mockTx.whatsappMonthlyCount.upsert.mockClear()
    mockTx.billingAccount.findUnique.mockClear()
    mockTx.billingAccount.update.mockClear()
    mockTx.billingAdjustment.findFirst.mockClear()
    mockTx.billingAdjustment.create.mockClear()
    mockTx.billingInvoice.findFirst.mockClear()
    mockTx.billingInvoice.count.mockClear()
    mockTx.billingInvoice.create.mockClear()
    mockTx.billingInvoice.update.mockClear()
    mockTx.billingInvoiceLine.create.mockClear()
    mockDeviceClient.sendMessage.mockClear()
    mockEnqueue.mockClear()

    // Re-apply prisma mock so other test files cannot pollute the module cache.
    // ESM live bindings would otherwise make messageService's prisma reference
    // point to the wrong mock object.
    mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

    // Default: device with quota 1000, no monthly usage → hasQuota: true
    // (quota service reads prisma.whatsappDevice + prisma.whatsappMonthlyCount)
    mockPrisma.whatsappDevice.findFirst.mockResolvedValue(mockDevice as any)
    mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
      ...mockDevice,
      currency: "USD",
    } as any)
    mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 1 } as any)
    mockPrisma.whatsappDevice.update.mockResolvedValue({} as any)
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
      balance: { toString: () => "100000" },
    } as any)
    mockPrisma.serviceSubscription.findFirst.mockResolvedValue(null) // No subscription = no quota gate enforcement
    mockPrisma.billingUsageLedger.create.mockResolvedValue({
      id: "ledger-1",
    } as any)

    // $transaction passthrough — flatten the async callback so callers
    // don't receive a Promise<Promise<Result>>.
    mockPrisma.$transaction.mockImplementation(
      async (fn: any) => await fn(mockTx)
    )

    // tx defaults: device found, no existing count → creates new count
    mockTx.whatsappDevice.findFirst.mockResolvedValue(mockDevice as any)
    mockTx.whatsappDevice.findUnique.mockResolvedValue({
      ...mockDevice,
      quotaBaseOut: 1000,
    } as any)
    mockTx.whatsappDevice.updateMany.mockResolvedValue({ count: 1 })
    mockTx.whatsappDevice.update.mockResolvedValue(mockDevice as any)
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
      balance: {
        toFixed: () => "100000",
        gte: () => true,
        gt: () => true,
        minus: () => ({
          toFixed: () => "99950",
          lt: () => false,
          gt: () => false,
        }),
      },
    } as any)
    mockTx.billingAccount.update.mockResolvedValue({
      id: "ba-1",
      balance: { toFixed: () => "99950" },
    } as any)
    mockTx.billingAdjustment.findFirst.mockResolvedValue(null)
    mockTx.billingAdjustment.create.mockResolvedValue({
      id: "adj-1",
    } as any)
    // Invoice defaults: no existing draft, creates new one
    mockTx.billingInvoice.findFirst.mockResolvedValue(null)
    mockTx.billingInvoice.count.mockResolvedValue(0)
    mockTx.billingInvoice.create.mockResolvedValue({
      id: "inv-1",
      status: "DRAFT",
      billingAccountId: "ba-1",
      currency: "IDR",
      periodStart: new Date("2026-06-01"),
      periodEnd: new Date("2026-06-30"),
    } as any)
    mockTx.billingInvoice.update.mockResolvedValue({ id: "inv-1" } as any)
    mockTx.billingInvoiceLine.create.mockResolvedValue({ id: "line-1" } as any)

    // Default: ALLOWANCE path (prisma.whatsappDevice.updateMany returns count=1)
    mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
      id: "device-1",
      quotaBaseOut: 999,
    } as any)
    mockPrisma.whatsappDevice.update.mockResolvedValue(mockDevice as any)

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
      // Simulate allowance exhausted + overage fails due to insufficient balance.
      // Phase 1: updateMany returns 0 (no allowance to consume)
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      // Phase 2: device found with 0 allowance
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 0,
      } as any)
      // Phase 3: debitServiceBalance -> $transaction -> mockTx.
      // Make billingAccount balance cause INSUFFICIENT_BALANCE in executeMutation.
      mockTx.billingAccount.findUnique.mockResolvedValue({
        id: "ba-1",
        balance: {
          minus: () => ({
            lt: () => true, // balanceAfter < 0 → throws INSUFFICIENT_BALANCE
          }),
        },
      } as any)

      await expect(sendMessageTestHelper()).rejects.toThrow(
        "Insufficient balance"
      )
    })

    it("throws when no device found", async () => {
      // New flow: device check happens first, throws "WhatsApp device not found"
      mockPrisma.whatsappDevice.findFirst.mockResolvedValue(null)

      await expect(sendMessageTestHelper()).rejects.toThrow(
        "WhatsApp device not found"
      )
    })

    it("deducts quota after sending", async () => {
      await sendMessageTestHelper({
        organizationId: "org-1",
        deviceId: "device-1",
      })

      // Deduct quota goes through $transaction
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it("calls WhatsApp billing allowance check before Meta API", async () => {
      // Verify the real WhatsappBillingService.consumeAllowanceOrChargeOverage
      // was called. Default setup: updateMany returns { count: 1 } (ALLOWANCE path).
      // Spy on the prisma call that Phase 1 makes.
      await sendMessageTestHelper({
        organizationId: "org-1",
        deviceId: "device-1",
      })

      // updateMany with allowance check params was called via the real service
      expect(mockPrisma.whatsappDevice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "device-1",
            quotaBaseOut: { gte: 1 },
          }),
        })
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

    it("sends and stores image messages", async () => {
      await sendMessageTestHelper({
        type: "image",
        mediaUrl: "https://example.com/image.jpg",
        caption: "Image caption",
      })

      expect(mockDeviceClient.sendMessage).toHaveBeenCalledWith({
        to: "+1234567890",
        type: "image",
        payload: {
          link: "https://example.com/image.jpg",
          caption: "Image caption",
          filename: undefined,
        },
      })
      expect(mockPrisma.whatsappMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageType: "image",
            body: "Image caption",
            mediaUrl: "https://example.com/image.jpg",
          }),
        })
      )
    })

    it("sends location messages", async () => {
      await sendMessageTestHelper({
        type: "location",
        latitude: -6.2,
        longitude: 106.8,
        name: "Jakarta",
        address: "Jakarta, ID",
      })

      expect(mockDeviceClient.sendMessage).toHaveBeenCalledWith({
        to: "+1234567890",
        type: "location",
        payload: {
          latitude: -6.2,
          longitude: 106.8,
          name: "Jakarta",
          address: "Jakarta, ID",
        },
      })
    })

    it("does not create broadcast campaign records for direct messages", async () => {
      await sendMessageTestHelper()

      expect(mockPrisma.whatsappBroadcastCampaign.create).not.toHaveBeenCalled()
      expect(
        mockPrisma.whatsappBroadcastRecipient.create
      ).not.toHaveBeenCalled()
      expect(mockEnqueue).not.toHaveBeenCalled()
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

      await expect(sendMessageTestHelper()).rejects.toThrow(
        InsufficientQuotaError
      )
    })

    // ── WhatsApp Billing Integration Tests ────────────────────────────────

    it("sends message within allowance (no balance change)", async () => {
      // Default mock setup: updateMany returns { count: 1 } → ALLOWANCE path
      const result = await sendMessageTestHelper()

      expect(result.status).toBe("sent")
      expect(result.waMessageId).toBe("wa-msg-123")
      expect(mockDeviceClient.sendMessage).toHaveBeenCalled()
      // No overage charge — billing adjustment should NOT be created
      expect(mockTx.billingAdjustment.create).not.toHaveBeenCalled()
    })

    it("sends message after overage charge succeeds", async () => {
      // Simulate allowance exhausted — overage charged
      // Phase 1: updateMany returns 0 (no allowance)
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      // Phase 2: device has 0 allowance remaining
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 0,
      } as any)
      // Phase 3: debitServiceBalance goes through $transaction → mockTx.
      // Default mockTx setup makes it succeed (balance minus lt() returns false).

      const result = await sendMessageTestHelper()

      expect(result.status).toBe("sent")
      expect(mockDeviceClient.sendMessage).toHaveBeenCalled()
      expect(mockTx.billingAdjustment.create).toHaveBeenCalled()
    })

    it("does not call Meta API when overage balance is insufficient", async () => {
      // Simulate allowance exhausted + insufficient balance
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 0,
      } as any)
      // Make debitServiceBalance throw INSUFFICIENT_BALANCE
      mockTx.billingAccount.findUnique.mockResolvedValue({
        id: "ba-1",
        balance: {
          minus: () => ({
            lt: () => true, // balanceAfter < 0 → INSUFFICIENT_BALANCE
          }),
        },
      } as any)

      await expect(sendMessageTestHelper()).rejects.toThrow(
        "Insufficient balance"
      )

      // Meta API should NOT be called — billing rejection happens before external call
      expect(mockDeviceClient.sendMessage).not.toHaveBeenCalled()
    })

    it("returns INSUFFICIENT_BALANCE error message for overage reject", async () => {
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 0,
      } as any)
      mockTx.billingAccount.findUnique.mockResolvedValue({
        id: "ba-1",
        balance: {
          minus: () => ({
            lt: () => true,
          }),
        },
      } as any)

      try {
        await sendMessageTestHelper()
        expect(true).toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
        expect((err as Error).message).toContain("Insufficient balance")
      }
    })

    it("restores allowance when Meta API fails after allowance was consumed", async () => {
      // Default: ALLOWANCE path (updateMany returns { count: 1 })
      mockDeviceClient.sendMessage.mockRejectedValue(new Error("API Error"))

      await sendMessageTestHelper()

      // restoreAllowance calls prisma.whatsappDevice.update with increment
      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device-1" },
          data: { quotaBaseOut: { increment: 1 } },
        })
      )
    })

    it("logs warning but does not restore balance when overage charged + Meta API fails", async () => {
      const consoleWarnSpy = mock(() => {})
      const origWarn = console.warn
      console.warn = consoleWarnSpy

      // Overage path
      mockPrisma.whatsappDevice.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 0,
      } as any)
      mockDeviceClient.sendMessage.mockRejectedValue(new Error("API Error"))

      await sendMessageTestHelper()

      // restoreAllowance should NOT be called for overage
      // (prisma.whatsappDevice.update with increment should NOT be called)
      expect(mockPrisma.whatsappDevice.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: { quotaBaseOut: { increment: expect.any(Number) } },
        })
      )
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
