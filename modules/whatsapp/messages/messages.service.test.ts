import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"

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
    create: mock(async () => ({
      id: "group_default",
      organizationId: "tenant-1",
      name: "Ungrouped",
    })),
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
  billingContact: {
    findMany: mock(async () => []),
  },
  whatsappWebhook: {
    findMany: mock(async () => [
      {
        id: "webhook-1",
        organizationId: "org-1",
        whatsappDeviceId: "device-1",
      },
    ]),
  },
  whatsappQuotaCreditRate: {
    findUnique: mock(async () => null),
    findFirst: mock(async () => ({
      id: "rate-1",
      category: "REPLY",
      country: "ID",
      quotaCredit: new Prisma.Decimal("1.00"),
      isActive: true,
    })),
  },
  whatsappBasePrice: {
    findUnique: mock(async () => null),
    findFirst: mock(async () => ({
      id: "price-1",
      category: "REPLY",
      country: "ID",
      basePrice: new Prisma.Decimal("300"),
      currency: "IDR",
      isActive: true,
    })),
  },
  $transaction: mock(async (fn: any) => await fn(mockTx)),
}

const mockDeviceClient = {
  sendMessage: mock(async () => ({ providerMessageId: "wa-msg-123" })),
  sendReply: mock(async () => ({ providerMessageId: "wa-msg-123" })),
  sendTemplateMessage: mock(async () => ({ providerMessageId: "wa-tmpl-123" })),
}
const mockEnqueue = mock(async () => {})
const mockEnqueueQuotaReconciliation = mock(async () => {})
const mockEnqueueWebhook = mock(async () => {})

mock.module("@/lib/queue/quota-reconciliation", () => ({
  enqueueQuotaReconciliation: mockEnqueueQuotaReconciliation,
}))

mock.module("@/lib/queue/whatsapp-webhook-outgoing", () => ({
  enqueueOutgoingWebhook: mockEnqueueWebhook,
}))

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
const {
  WhatsappSendFailedError,
  WhatsappSessionWindowClosedError,
  UnsupportedDestinationCountryError,
} = await import("./messages.errors")
const { messageService } = await import("./messages.service")

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
    mockPrisma.whatsappMonthlyCount.upsert.mockClear()
    mockPrisma.whatsappDailyCount.upsert.mockClear()
    mockPrisma.whatsappBillingLedger.create.mockClear()
    mockPrisma.billingAccount.findUnique.mockClear()
    mockPrisma.billingContact.findMany.mockClear()
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
    mockPrisma.whatsappWebhook.findMany.mockClear()
    mockTx.whatsappMonthlyCount.upsert.mockClear()
    mockTx.billingAccount.findUnique.mockClear()
    mockTx.billingAccount.update.mockClear()
    mockEnqueueQuotaReconciliation.mockClear()
    mockEnqueueWebhook.mockClear()
    mockTx.billingAdjustment.findFirst.mockClear()
    mockTx.billingAdjustment.create.mockClear()
    mockTx.billingInvoice.findFirst.mockClear()
    mockTx.billingInvoice.count.mockClear()
    mockTx.billingInvoice.create.mockClear()
    mockTx.billingInvoice.update.mockClear()
    mockTx.billingInvoiceLine.create.mockClear()
    mockDeviceClient.sendMessage.mockClear()
    mockDeviceClient.sendReply.mockClear()
    mockDeviceClient.sendTemplateMessage.mockClear()
    mockEnqueue.mockClear()

    // Re-apply prisma mock so other test files cannot pollute the module cache.
    // ESM live bindings would otherwise make messageService's prisma reference
    // point to the wrong mock object.
    mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))
    mockPrisma.whatsappQuotaCreditRate.findFirst.mockResolvedValue({
      id: "rate-1",
      category: "REPLY",
      country: "UNKNOWN",
      quotaCredit: new Prisma.Decimal("1.00"),
      isActive: true,
    })
    mockPrisma.whatsappBasePrice.findFirst.mockResolvedValue({
      id: "price-1",
      category: "REPLY",
      country: "UNKNOWN",
      basePrice: new Prisma.Decimal("300"),
      currency: "IDR",
      isActive: true,
    })

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
    mockPrisma.whatsappConversation.findFirst.mockResolvedValue({
      id: "conv-1",
      lastDirection: "INBOX",
      lastMessageAt: new Date(),
    } as any)
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
    mockDeviceClient.sendReply.mockResolvedValue({
      providerMessageId: "wa-msg-123",
    })
    mockDeviceClient.sendTemplateMessage.mockResolvedValue({
      providerMessageId: "wa-tmpl-123",
    })
    mockEnqueue.mockResolvedValue(undefined)
  })

  describe("sendMessage", () => {
    it("rejects message when destination country is unconfigured in pricing", async () => {
      mockPrisma.whatsappQuotaCreditRate.findFirst.mockResolvedValueOnce(
        null as any
      )
      expect(
        sendMessageTestHelper({ phoneNumber: "+14155550100" })
      ).rejects.toThrow(
        "Destination country 'US' for phone number '+14155550100' is not configured in pricing rates."
      )
    })
    it("sends message and returns result with waMessageId", async () => {
      const result = await sendMessageTestHelper({ message: "Hello world" })

      expect(result).toHaveProperty("jobId")
      expect(result).toHaveProperty("messageId")
      expect(result.waMessageId).toBe("wa-msg-123")
      expect(result.status).toBe("sent")
      expect(mockDeviceClient.sendReply).toHaveBeenCalledWith({
        to: "+1234567890",
        type: "text",
        payload: { body: "Hello world" },
      })
      expect(mockEnqueueWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: "webhook-1",
          organizationId: "org-1",
          deviceId: "device-1",
          eventType: "message_sent",
          eventId: "msg-1",
        })
      )
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

    it("rejects outside the customer service window before billing or Meta", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue({
        id: "conv-1",
        lastDirection: "OUTBOX",
        lastMessageAt: new Date(),
      } as any)

      await expect(sendMessageTestHelper()).rejects.toBeInstanceOf(
        WhatsappSessionWindowClosedError
      )

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
      expect(mockDeviceClient.sendReply).not.toHaveBeenCalled()
      expect(mockDeviceClient.sendMessage).not.toHaveBeenCalled()
      expect(mockPrisma.whatsappMessage.create).not.toHaveBeenCalled()
    })
    it("rejects when the conversation is not found", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue(null)

      await expect(sendMessageTestHelper()).rejects.toBeInstanceOf(
        WhatsappSessionWindowClosedError
      )
    })

    it("rejects when lastMessageAt is null, undefined, or too old", async () => {
      for (const lastMessageAt of [
        null,
        undefined,
        new Date(Date.now() - 25 * 60 * 60 * 1000),
      ]) {
        mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce({
          id: "conv-1",
          organizationId: "org-1",
          contactPhone: "+1234567890",
          lastDirection: "INBOX",
          lastMessageAt,
          whatsappDeviceId: "device-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as never)
        await expect(sendMessageTestHelper()).rejects.toBeInstanceOf(
          WhatsappSessionWindowClosedError
        )
      }
    })

    it("allows an inbound conversation updated within 24 hours", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue({
        id: "conv-1",
        organizationId: "org-1",
        contactPhone: "+1234567890",
        lastDirection: "INBOX",
        lastMessageAt: new Date(Date.now() - 60 * 60 * 1000),
        whatsappDeviceId: "device-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
      await expect(sendMessageTestHelper()).resolves.toMatchObject({
        status: "sent",
      })
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
            conversationId: "conv-1",
            messageType: "text",
            body: "Hello",
            mediaUrl: undefined,
            waMessageId: "wa-msg-123",
            metadata: expect.objectContaining({
              quotaPending: false,
            }),
          }),
        })
      )
    })

    it("sends and stores image messages", async () => {
      const result = await sendMessageTestHelper({
        phoneNumber: "+628123456789",
        type: "image",
        mediaUrl: "https://example.com/image.jpg",
        caption: "Image caption",
      })

      expect(mockDeviceClient.sendReply).toHaveBeenCalledWith({
        to: "+628123456789",
        type: "image",
        payload: {
          link: "https://example.com/image.jpg",
          caption: "Image caption",
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
    it("sends document messages with filename and caption", async () => {
      await sendMessageTestHelper({
        type: "document",
        mediaUrl: "https://example.com/document.pdf",
        caption: "Document caption",
        filename: "document.pdf",
      })

      expect(mockDeviceClient.sendReply).toHaveBeenCalledWith({
        to: "+1234567890",
        type: "document",
        payload: {
          link: "https://example.com/document.pdf",
          caption: "Document caption",
          filename: "document.pdf",
        },
      })
    })

    it("sends audio messages through the generic message method", async () => {
      await sendMessageTestHelper({
        type: "audio",
        mediaUrl: "https://example.com/audio.mp3",
      })

      expect(mockDeviceClient.sendMessage).toHaveBeenCalledWith({
        to: "+1234567890",
        type: "audio",
        payload: { link: "https://example.com/audio.mp3" },
      })
    })

    it("sends an unrecognized custom type through the generic method", async () => {
      await sendMessageTestHelper({
        type: "custom" as never,
        mediaUrl: "https://example.com/custom",
        caption: "Custom payload",
      })

      expect(mockDeviceClient.sendMessage).toHaveBeenCalledWith({
        to: "+1234567890",
        type: "custom",
        payload: {
          link: "https://example.com/custom",
          caption: "Custom payload",
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

    it("throws and records a failed status when Meta API fails", async () => {
      mockDeviceClient.sendReply.mockRejectedValue(new Error("API Error"))

      await expect(sendMessageTestHelper()).rejects.toBeInstanceOf(
        WhatsappSendFailedError
      )

      expect(mockPrisma.whatsappMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            waMessageId: undefined,
            statusHistory: {
              create: expect.objectContaining({
                status: "FAILED",
                error: "API Error",
              }),
            },
          }),
        })
      )
      expect(mockPrisma.whatsappBillingLedger.create).not.toHaveBeenCalled()
      expect(mockPrisma.whatsappDailyCount.upsert).not.toHaveBeenCalled()
      expect(mockPrisma.whatsappMonthlyCount.upsert).not.toHaveBeenCalled()
      expect(mockPrisma.billingUsageLedger.create).not.toHaveBeenCalled()
    })

    it("rejects when Meta does not return a provider message ID", async () => {
      mockDeviceClient.sendReply.mockResolvedValue({
        providerMessageId: undefined,
      } as any)

      await expect(sendMessageTestHelper()).rejects.toMatchObject({
        name: "WhatsappSendFailedError",
        message: "Meta Cloud API returned no message ID",
      })

      expect(mockPrisma.whatsappMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            statusHistory: {
              create: expect.objectContaining({
                status: "FAILED",
                error: "Meta Cloud API returned no message ID",
              }),
            },
          }),
        })
      )
    })

    it("does not create a conversation when the session window is closed", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue(null)

      await expect(sendMessageTestHelper()).rejects.toBeInstanceOf(
        WhatsappSessionWindowClosedError
      )

      expect(mockPrisma.whatsappConversation.create).not.toHaveBeenCalled()
    })

    it("uses existing conversation if found", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValue({
        id: "existing-conv",
        lastDirection: "INBOX",
        lastMessageAt: new Date(),
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
    it("records usage and reconciles when subscription quota deduction fails", async () => {
      mockPrisma.serviceSubscription.findFirst.mockResolvedValue({
        id: "subscription-1",
        organizationId: "org-1",
        status: "ACTIVE",
        planId: "plan-1",
        plan: { code: "WHATSAPP", resources: { unlimited: true } },
      } as never)
      mockPrisma.servicePricing.findFirst.mockResolvedValue({
        planId: "plan-1",
        type: "PAYG",
        billingMode: "PAYG",
        billingPeriod: null,
        currency: "IDR",
        effectiveFrom: new Date("2026-01-01"),
        effectiveTo: null,
        chargeUnit: "MESSAGE",
        basePriceIdr: new Prisma.Decimal("0"),
        monthlyCapIdr: null,
        unitRateCpu: null,
        unitRateMem: null,
        unitRateMessage: new Prisma.Decimal("50"),
        servicePlan: { code: "WHATSAPP", packageId: "WHATSAPP", resources: {} },
        region: { code: "GLOBAL" },
      } as never)
      mockPrisma.whatsappDevice.update.mockResolvedValue({
        id: "device-1",
        currentQuotaUsed: new Prisma.Decimal("50"),
      } as never)
      let transactionCount = 0
      mockPrisma.$transaction.mockImplementation(async (fn: unknown) => {
        transactionCount++
        if (transactionCount === 1) {
          return await (fn as (tx: typeof mockTx) => Promise<unknown>)(mockTx)
        }
        throw new Error("quota deduction failed")
      })
      const result = await sendMessageTestHelper()

      expect(result.status).toBe("sent")
      expect(mockEnqueueQuotaReconciliation).toHaveBeenCalledWith(
        "org-1",
        "device-1",
        "OUT",
        expect.any(String),
        expect.any(Date)
      )
      expect(mockPrisma.billingUsageLedger.create).toHaveBeenCalled()
      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device-1" },
          data: { currentQuotaUsed: { increment: expect.any(Object) } },
        })
      )
    })

    // ── WhatsApp Billing Integration Tests ────────────────────────────────

    it("sends message within allowance (no balance change)", async () => {
      const result = await sendMessageTestHelper()

      expect(result.status).toBe("sent")
      expect(result.waMessageId).toBe("wa-msg-123")
      expect(mockDeviceClient.sendReply).toHaveBeenCalled()
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
      expect(mockDeviceClient.sendReply).toHaveBeenCalled()
      // billingAdjustment.create is called inside the $transaction (via debitServiceBalance)
      expect(mockTx.billingAdjustment.create).toHaveBeenCalled()
    })
    it("uses addon allowance when the default allowance is exhausted", async () => {
      mockTx.whatsappDevice.findUnique.mockResolvedValue({
        id: "device-1",
        quotaBaseOut: new Prisma.Decimal("0"),
        addonQuota: new Prisma.Decimal("1000"),
      } as never)
      const result = await sendMessageTestHelper()

      expect(result.status).toBe("sent")
      expect(mockTx.billingAdjustment.create).not.toHaveBeenCalled()
      expect(mockTx.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device-1" },
          data: expect.objectContaining({
            quotaBaseOut: new Prisma.Decimal("0"),
            addonQuota: { decrement: expect.any(Object) },
          }),
        })
      )
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
      expect(mockDeviceClient.sendReply).not.toHaveBeenCalled()
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
      mockDeviceClient.sendReply.mockRejectedValue(new Error("API Error"))

      await expect(sendMessageTestHelper()).rejects.toBeInstanceOf(
        WhatsappSendFailedError
      )

      // restoreAllowance updates quotaBaseOut (and possibly addonQuota)
      // via prisma.whatsappDevice.update — verify the call happened
      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device-1" },
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

      mockDeviceClient.sendReply.mockRejectedValue(new Error("API Error"))

      await expect(sendMessageTestHelper()).rejects.toBeInstanceOf(
        WhatsappSendFailedError
      )

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
      mockPrisma.serviceSubscription.findFirst.mockResolvedValueOnce(
        null as any
      )
      mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce({
        id: "conv-1",
        lastDirection: "INBOX",
        lastMessageAt: new Date(),
      } as any)

      const result = await messageService.sendMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        type: "interactive",
        interactivePayload: {
          type: "button",
          body: { text: "Hello" },
          action: {
            buttons: [{ type: "reply", reply: { id: "b1", title: "OK" } }],
          },
        },
      })

      expect(result.status).toBe("sent")
      expect(mockDeviceClient.sendMessage).toHaveBeenCalledWith({
        to: "+1234567890",
        type: "interactive",
        payload: {
          type: "button",
          body: { text: "Hello" },
          action: {
            buttons: [{ type: "reply", reply: { id: "b1", title: "OK" } }],
          },
        },
      })
    })
  })

  describe("sendTemplateMessage", () => {
    const mockTemplateLanguage = {
      id: "lang-en",
      lang: "en",
      body: "Hello {{1}}",
    } satisfies WhatsAppTemplateLanguage

    it("sends template message via Meta API", async () => {
      await messageService.sendTemplateMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        templateName: "hello_world",
        templateLanguage: "en",
        fields: ["John"],
        renderedBody: "Hello John",
        templateLanguageData: mockTemplateLanguage,
      })

      expect(mockDeviceClient.sendTemplateMessage).toHaveBeenCalledWith({
        to: "+1234567890",
        templateName: "hello_world",
        templateLanguage: "en",
        fields: ["John"],
        buttons: [],
      })
      expect(mockEnqueueWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: "webhook-1",
          eventType: "message_sent",
          eventId: "msg-1",
        })
      )
    })
    it("does not fail when the sent-message webhook dispatch rejects", async () => {
      mockEnqueueWebhook.mockRejectedValueOnce(new Error("Webhook offline"))

      const result = await messageService.sendTemplateMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        templateName: "hello_world",
        templateLanguage: "en",
        fields: ["John"],
        renderedBody: "Hello John",
        templateLanguageData: mockTemplateLanguage,
      })

      await Promise.resolve()
      expect(result.status).toBe("sent")
      expect(mockEnqueueWebhook).toHaveBeenCalled()
    })

    it("creates message with messageType template", async () => {
      await messageService.sendTemplateMessage({
        organizationId: "org-1",
        phoneNumber: "+1234567890",
        templateName: "hello_world",
        templateLanguage: "en",
        fields: ["John"],
        renderedBody: "Hello John",
        templateLanguageData: mockTemplateLanguage,
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
        templateLanguageData: mockTemplateLanguage,
      })

      expect(mockPrisma.whatsappMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              templateName: "hello_world",
              templateLanguage: "en",
              fields: ["John", "Doe"],
              templateLanguageData: mockTemplateLanguage,
            }),
          }),
        })
      )
    })

    it("throws and records a failed status when Meta rejects a template", async () => {
      mockDeviceClient.sendTemplateMessage.mockRejectedValue(
        new Error("Template rejected by Meta")
      )

      await expect(
        messageService.sendTemplateMessage({
          organizationId: "org-1",
          phoneNumber: "+1234567890",
          templateName: "hello_world",
          templateLanguage: "en",
          fields: ["John"],
          renderedBody: "Hello John",
          templateLanguageData: mockTemplateLanguage,
        })
      ).rejects.toBeInstanceOf(WhatsappSendFailedError)

      expect(mockPrisma.whatsappMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messageType: "template",
            statusHistory: {
              create: expect.objectContaining({
                status: "FAILED",
                error: "Template rejected by Meta",
              }),
            },
          }),
        })
      )
      expect(mockPrisma.whatsappDevice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "device-1" },
          data: expect.objectContaining({
            quotaBaseOut: { increment: expect.any(Object) },
          }),
        })
      )
      expect(mockPrisma.whatsappBillingLedger.create).not.toHaveBeenCalled()
      expect(mockPrisma.whatsappDailyCount.upsert).not.toHaveBeenCalled()
      expect(mockPrisma.whatsappMonthlyCount.upsert).not.toHaveBeenCalled()
      expect(mockPrisma.billingUsageLedger.create).not.toHaveBeenCalled()
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
