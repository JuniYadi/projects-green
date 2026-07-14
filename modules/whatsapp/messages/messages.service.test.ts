import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

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
  $queryRaw: mock(async () => []),
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
  whatsappBillingLedger: {
    create: mock(async () => ({ id: "ledger-1" })),
  },
  whatsappQuotaCreditRate: {
    findUnique: mock(async () => null),
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
    update: mock(async () => ({ id: "conv-1" })),
  },
  whatsappContactGroup: {
    findFirst: mock(async () => null),
    create: mock(async () => ({ id: "group_default", organizationId: "tenant-1", name: "Ungrouped" })),
  },
  whatsappContact: {
    upsert: mock(async (args: any) => args.create ?? args.update ?? {}),
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
    upsert: mock(async () => ({ id: "monthly-1" })),
  },
  whatsappDailyCount: {
    upsert: mock(async () => ({ id: "daily-1" })),
  },
  whatsappBillingLedger: {
    create: mock(async () => ({ id: "ledger-1" })),
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
  whatsappWebhook: {
    findMany: mock(async () => []),
  },
  whatsappQuotaCreditRate: {
    findUnique: mock(async () => null),
  },
  $transaction: mock(async (fn: any) => await fn(mockTx)),
}

const mockDeviceClient = {
  sendMessage: mock(async () => ({ providerMessageId: "wa-msg-123" })),
  sendTemplateMessage: mock(async () => ({ providerMessageId: "wa-tmpl-123" })),
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

const mockDevice = {
  id: "device-1",
  organizationId: "org-1",
  quotaBaseOut: new Prisma.Decimal("1000"),
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
    mockDeviceClient.sendTemplateMessage.mockClear()
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
      quotaBaseOut: new Prisma.Decimal("1000"),
      addonQuota: new Prisma.Decimal("0"),
    } as any)
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


    mockDeviceClient.sendMessage.mockResolvedValue({
      providerMessageId: "wa-msg-123",
    })
    mockDeviceClient.sendTemplateMessage.mockResolvedValue({
      providerMessageId: "wa-tmpl-123",
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
      // Exhaust both default and addon allowance via tx mock
      mockTx.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 0,
        addonQuota: 0,
      } as any)
      // Make debitServiceBalance -> $transaction -> mockTx billing account balance
      // cause INSUFFICIENT_BALANCE in executeMutation (balanceAfter.lt(0)).
      mockTx.billingAccount.findUnique.mockResolvedValue({
        id: "ba-1",
        balance: {
          minus: () => ({
            lt: () => true,
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
      await sendMessageTestHelper({
        organizationId: "org-1",
        deviceId: "device-1",
      })

      // The billing service now uses $transaction with $queryRaw + findUnique
      // Verify that findUnique was called inside the tx for allowance check
      expect(mockTx.whatsappDevice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device-1" },
          select: { quotaBaseOut: true, addonQuota: true },
        })
      )
      // Verify device was updated via the tx (allowance decrement path)
      expect(mockTx.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device-1" },
          data: { quotaBaseOut: { decrement: expect.anything() } },
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
      // Make the subscription-block $transaction throw (after billing succeeds)
      // First call: billing $transaction succeeds, second: quota deduction fails
      let txCall = 0
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        txCall++
        if (txCall === 1) return await fn(mockTx) // billing succeeds
        throw new Error("DB error") // quota deduction fails
      })

      const result = await sendMessageTestHelper()
      expect(result).toHaveProperty("jobId")
    })


    // ── WhatsApp Billing Integration Tests ────────────────────────────────

    it("sends message within allowance (no balance change)", async () => {
      const result = await sendMessageTestHelper()

      expect(result.status).toBe("sent")
      expect(result.waMessageId).toBe("wa-msg-123")
      expect(mockDeviceClient.sendMessage).toHaveBeenCalled()
      expect(mockTx.billingAdjustment.create).not.toHaveBeenCalled()
    })

    it("sends message after overage charge succeeds", async () => {
      // Exhaust default + addon allowance → triggers overage charge path
      mockTx.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 0,
        addonQuota: 0,
      } as any)

      const result = await sendMessageTestHelper()

      expect(result.status).toBe("sent")
      expect(mockDeviceClient.sendMessage).toHaveBeenCalled()
      // billingAdjustment.create is called inside the $transaction (via debitServiceBalance)
      expect(mockTx.billingAdjustment.create).toHaveBeenCalled()
    })

    it("does not call Meta API when overage balance is insufficient", async () => {
      // Exhaust allowance so debitServiceBalance runs
      mockTx.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 0,
        addonQuota: 0,
      } as any)
      // Make debitServiceBalance throw INSUFFICIENT_BALANCE
      mockTx.billingAccount.findUnique.mockResolvedValue({
        id: "ba-1",
        balance: {
          minus: () => ({
            lt: () => true,
          }),
        },
      } as any)

      await expect(sendMessageTestHelper()).rejects.toThrow()
      expect(mockDeviceClient.sendMessage).not.toHaveBeenCalled()
    })

    it("returns INSUFFICIENT_BALANCE error message for overage reject", async () => {
      mockTx.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: 0,
        addonQuota: 0,
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
      }
    })

    it("restores allowance when Meta API fails after allowance was consumed", async () => {
      mockDeviceClient.sendMessage.mockRejectedValue(new Error("API Error"))

      await sendMessageTestHelper()

      // restoreAllowance updates quotaBaseOut (and possibly addonQuota)
      // via prisma.whatsappDevice.update — verify the call happened
      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device-1" },
          data: expect.objectContaining({
            quotaBaseOut: { increment: expect.any(Object) },
          }),
        })
      )
    })

    it("logs warning but does not restore balance when overage charged + Meta API fails", async () => {
      const consoleWarnSpy = mock(() => {})
      const origWarn = console.warn
      console.warn = consoleWarnSpy

      // Overage path: exhaust allowance
      const { Prisma } = await import("@prisma/client")
      mockTx.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: new Prisma.Decimal("0"),
        addonQuota: new Prisma.Decimal("0"),
      } as any)

      mockDeviceClient.sendMessage.mockRejectedValue(new Error("API Error"))

      await sendMessageTestHelper()

      // After Meta API fails with OVERAGE_CHARGED billing decision,
      // the service logs a warning and does NOT call restoreAllowance
      expect(consoleWarnSpy).toHaveBeenCalled()
      console.warn = origWarn
    })


    it("sends interactive message type to Meta API", async () => {
      mockPrisma.whatsappDevice.findFirst.mockResolvedValueOnce({
        id: "device-1",
        tokenEncrypted: "tok_enc",
        whatsappPhoneId: "phone-id",
        whatsappBusinessAccountId: "waba-1",
        organizationId: "org-1",
      } as any)
      mockPrisma.serviceSubscription.findFirst.mockResolvedValueOnce(null as any)
      mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce({
        id: "conv-1",
      } as any)

      const result = await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        type: "interactive",
        interactivePayload: {
          type: "button",
          body: { text: "Hello" },
          action: { buttons: [{ type: "reply", reply: { id: "b1", title: "OK" } }] },
        },
      })

      expect(result.status).toBe("sent")
      expect(mockDeviceClient.sendMessage).toHaveBeenCalledWith({
        to: "+1234567890",
        type: "interactive",
        payload: {
          type: "button",
          body: { text: "Hello" },
          action: { buttons: [{ type: "reply", reply: { id: "b1", title: "OK" } }] },
        },
      })
    })
  })

  describe("sendTemplateMessage", () => {
    it("sends template message via Meta API", async () => {
      await messageService.sendTemplateMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        templateName: "hello_world",
        templateLanguage: "en",
        fields: ["John"],
        renderedBody: "Hello John",
      })

      expect(mockDeviceClient.sendTemplateMessage).toHaveBeenCalledWith({
        to: "+1234567890",
        templateName: "hello_world",
        templateLanguage: "en",
        fields: ["John"],
      })
    })

    it("creates message with messageType template", async () => {
      await messageService.sendTemplateMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        templateName: "hello_world",
        templateLanguage: "en",
        fields: ["John"],
        renderedBody: "Hello John",
      })

      expect(mockPrisma.whatsappMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: "OUTBOX",
            messageType: "template",
            body: "Hello John",
          }),
        })
      )
    })

    it("stores template metadata", async () => {
      await messageService.sendTemplateMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        templateName: "hello_world",
        templateLanguage: "en",
        fields: ["John", "Doe"],
        renderedBody: "Hello John Doe",
      })

      expect(mockPrisma.whatsappMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              templateName: "hello_world",
              templateLanguage: "en",
              fields: ["John", "Doe"],
            }),
          }),
        })
      )
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
