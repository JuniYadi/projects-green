import { mock, describe, it, expect, beforeEach } from "bun:test"
import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"
const Decimal = Prisma.Decimal
import {
  WhatsappSendFailedError,
  WhatsappSessionWindowClosedError,
  UnsupportedDestinationCountryError,
} from "../messages.errors"

// Mock prisma
const mockPrisma = {
  whatsappMessage: {
    count: mock(async () => 1),
    findMany: mock(async () => [{ id: "msg-1" }]),
    findFirst: mock<() => Promise<unknown>>(async () => ({ id: "msg-1" })),
    create: mock(async () => ({ id: "msg-new" })),
    update: mock(async () => ({ id: "msg-1", body: "Updated body" })),
    delete: mock(async () => ({ id: "msg-1" })),
  },
  whatsappConversation: {
    findFirst: mock(async () => ({ id: "conv-1", organizationId: "org-1" })),
  },
  whatsappTemplate: {
    findFirst: mock(async () => null),
  },
  whatsappDevice: {
    findMany: mock(async () => []),
  },
  whatsappQuotaCreditRate: {
    findMany: mock(async () => []),
  },
  whatsappBasePrice: {
    findMany: mock(async () => []),
    findFirst: mock(async () => null),
  },
  serviceSubscription: {
    findFirst: mock(async () => null),
  },
  servicePricing: {
    findFirst: mock(async () => null),
  },
  whatsappBillingLedger: {
    findFirst: mock<() => Promise<unknown>>(async () => null),
  },
  whatsappAuditLog: {
    findFirst: mock<() => Promise<unknown>>(async () => null),
  },
  whatsappWebhookEvent: {
    findMany: mock<() => Promise<unknown[]>>(async () => []),
  },
}

// Mock message service
const mockMessageService = {
  sendMessage: mock(async () => ({
    jobId: "job-1",
    messageId: "msg-1",
    waMessageId: "wa-123",
    status: "sent",
  })),
  sendTemplateMessage: mock(async () => ({
    ok: true,
    jobId: "job-template-1",
    messageId: "mock-id",
    waMessageId: "wa-template-1",
    status: "sent",
  })),
}

const mockLogAuditEvent = mock(async () => {})

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("@/modules/whatsapp/messages/messages.service", () => ({
  messageService: mockMessageService,
}))

mock.module("@/modules/whatsapp/audit/whatsapp-audit.service", () => ({
  logWhatsappAuditEvent: mockLogAuditEvent,
}))

import { setMockAuthContext } from "@/lib/whatsapp/__tests__/auth-mock"
import {
  InsufficientBalanceError,
  QuotaExceededError,
  DailyLimitExceededError,
} from "@/modules/billing/types"

class InsufficientQuotaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InsufficientQuotaError"
  }
}

mock.module("@/modules/whatsapp/messages/quota.service", () => ({
  InsufficientQuotaError,
}))

const mockResolveAuthContext: { current: any } = {
  current: {
    type: "workos",
    userId: "user-1",
    email: "admin@example.com",
    organizationId: "org-1",
    orgRole: "admin",
    platformRole: "none",
    source: "proxy_header",
  },
}

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: mock(async () => mockResolveAuthContext.current),
}))
const mockGetCachedUser = mock<
  () => Promise<{ name: string | null; email: string } | null>
>(async () => null)

mock.module("@/lib/workos-directory", () => ({
  getCachedUser: mockGetCachedUser,
}))

const { messagesRoutes } = await import("./messages.route")

const createTestApp = () => new Elysia().use(messagesRoutes).compile()

const authRequest = (path: string, options: RequestInit = {}) => {
  const url = path.startsWith("http") ? path : `http://localhost${path}`
  return new Request(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: "Bearer test",
    },
  })
}
const postJson = (path: string, body: unknown) =>
  authRequest(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })

describe("messagesRoutes", () => {
  beforeEach(() => {
    mockResolveAuthContext.current = {
      type: "workos",
      userId: "user-1",
      email: "admin@example.com",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
      source: "proxy_header",
    }
    setMockAuthContext({
      type: "workos",
      userId: "user-1",
      email: "admin@example.com",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
    })
    mockPrisma.whatsappMessage.create.mockClear()
    mockPrisma.whatsappMessage.update.mockClear()
    mockPrisma.whatsappMessage.delete.mockClear()
    mockPrisma.whatsappConversation.findFirst.mockClear()
    mockPrisma.whatsappQuotaCreditRate.findMany.mockClear()
    mockPrisma.whatsappBasePrice.findMany.mockClear()
    mockPrisma.whatsappBasePrice.findFirst.mockClear()
    mockPrisma.serviceSubscription.findFirst.mockClear()
    mockPrisma.servicePricing.findFirst.mockClear()
    mockPrisma.whatsappBillingLedger.findFirst.mockClear()
    mockPrisma.whatsappAuditLog.findFirst.mockClear()
    mockPrisma.whatsappWebhookEvent.findMany.mockClear()
    mockPrisma.whatsappTemplate.findFirst.mockClear()
    mockMessageService.sendTemplateMessage.mockClear()
    mockMessageService.sendMessage.mockClear()
    mockGetCachedUser.mockClear()

    mockPrisma.whatsappMessage.count.mockResolvedValue(1)
    mockPrisma.whatsappMessage.findMany.mockResolvedValue([
      { id: "msg-1" },
    ] as any)
    mockPrisma.whatsappMessage.findFirst.mockResolvedValue({
      id: "msg-1",
      body: "Test message",
      conversation: { organizationId: "org-1" },
    } as any)
    mockPrisma.whatsappMessage.create.mockResolvedValue({
      id: "msg-new",
    } as any)
    mockPrisma.whatsappMessage.update.mockResolvedValue({
      id: "msg-1",
      body: "Updated body",
    } as any)
    mockPrisma.whatsappMessage.delete.mockResolvedValue({ id: "msg-1" } as any)
    mockPrisma.whatsappConversation.findFirst.mockResolvedValue({
      id: "conv-1",
      organizationId: "org-1",
    } as any)
    mockMessageService.sendMessage.mockResolvedValue({
      jobId: "job-1",
      messageId: "msg-1",
      waMessageId: "wa-123",
      status: "sent",
    })
    mockPrisma.whatsappTemplate.findFirst.mockResolvedValue(null)
    mockPrisma.whatsappDevice.findMany.mockResolvedValue([])
    mockPrisma.whatsappQuotaCreditRate.findMany.mockResolvedValue([])
    mockPrisma.whatsappBasePrice.findMany.mockResolvedValue([])
    mockPrisma.whatsappBasePrice.findFirst.mockResolvedValue(null)
    mockPrisma.serviceSubscription.findFirst.mockResolvedValue(null)
    mockPrisma.whatsappBillingLedger.findFirst.mockResolvedValue(null)
    mockPrisma.whatsappAuditLog.findFirst.mockResolvedValue(null)
    mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValue([])
    mockGetCachedUser.mockResolvedValue(null)
    mockPrisma.servicePricing.findFirst.mockResolvedValue(null)
    mockMessageService.sendTemplateMessage.mockResolvedValue({
      ok: true,
      messageId: "mock-id",
      jobId: "job-template-1",
      waMessageId: "wa-template-1",
      status: "sent",
    })
  })

  describe("GET /messages", () => {
    it("returns 200 with messages array", async () => {
      const app = createTestApp()
      const res = await app.handle(authRequest("/messages"))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("returns 200 with filtered messages", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages?conversationId=conv-1&direction=OUTBOX")
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.messages).toBeDefined()
    })
  })

  describe("GET /messages/pricing", () => {
    it("returns device quota credits and PAYG overage pricing", async () => {
      mockPrisma.whatsappDevice.findMany.mockResolvedValue([
        {
          id: "device-1",
          phoneNumber: "+6281234567890",
          rates: "BASE",
          quotaBaseOut: 50,
          addonQuota: 25,
        },
      ] as any)
      mockPrisma.whatsappQuotaCreditRate.findMany.mockResolvedValue([
        {
          category: "MARKETING",
          country: "ID",
          quotaCredit: "2.00",
          description: "Marketing template credit",
        },
      ] as any)
      mockPrisma.whatsappBasePrice.findMany.mockResolvedValue([
        {
          category: "UTILITY",
          country: "ID",
          basePrice: "150",
          currency: "IDR",
        },
      ] as any)
      mockPrisma.whatsappBasePrice.findFirst.mockResolvedValue({
        basePrice: "150",
        currency: "IDR",
      } as any)
      mockPrisma.serviceSubscription.findFirst.mockResolvedValue({
        planId: "plan-1",
        plan: { resources: {} },
      } as any)
      mockPrisma.servicePricing.findFirst.mockResolvedValue({
        id: "pricing-1",
        planId: "plan-1",
        regionId: "region-1",
        type: "PAYG",
        billingMode: "PAYG",
        currency: "IDR",
        basePriceIdr: "0",
        monthlyCapIdr: null,
        unitRateCpu: null,
        unitRateMem: null,
        unitRateMessage: "150",
        servicePlan: { code: "STANDARD", packageId: "WHATSAPP" },
        region: { code: "GLOBAL" },
      } as any)

      const res = await createTestApp().handle(authRequest("/messages/pricing"))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.overage).toMatchObject({
        unitPrice: "197",
        currency: "IDR",
        configured: true,
      })
      expect(body.devices[0]).toMatchObject({
        deviceId: "device-1",
        phoneNumber: "+6281234567890",
        country: "ID",
        rateTier: "BASE",
        quotaRemaining: 75,
      })
      expect(body.devices[0].categories).toHaveLength(4)
      expect(body.devices[0].categories).toContainEqual(
        expect.objectContaining({
          category: "MARKETING",
          quotaCredit: "2.00",
          configured: true,
          description: "Marketing template credit",
        })
      )
      expect(body.devices[0].categories).toContainEqual(
        expect.objectContaining({
          category: "SERVICE",
          quotaCredit: "1",
          configured: false,
          description: null,
        })
      )
      expect(mockPrisma.whatsappDevice.findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", status: "ACTIVE" },
        select: {
          id: true,
          phoneNumber: true,
          rates: true,
          quotaBaseOut: true,
          addonQuota: true,
        },
        orderBy: { createdAt: "desc" },
      })
      expect(mockPrisma.whatsappQuotaCreditRate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country: { in: ["ID"] },
            isActive: true,
          }),
        })
      )
    })
  })

  describe("POST /messages (Unified Dispatcher)", () => {
    it("dispatches template message with legacy KrmPesan payload format", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce({
        id: "template-1",
        slug: "otp_login",
        name: "otp_login",
        whatsappDeviceId: "device-1",
        category: "AUTHENTICATION",
        languages: [
          {
            id: "lang-1",
            lang: "id",
            body: "Kode OTP Anda: {{1}}",
          },
        ],
      } as any)

      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages", {
          phone: "081216667996",
          template_name: "otp_login",
          template_language: "id",
          template: {
            body: ["492019"],
          },
        })
      )
      expect(res.status).toBe(200)
      const resBody = await res.json()
      expect(resBody.ok).toBe(true)
      expect(resBody.waMessageId).toBe("wa-template-1")
      expect(mockMessageService.sendTemplateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+6281216667996",
          templateName: "otp_login",
          fields: ["492019"],
        })
      )
    })

    it("dispatches template message with non-sequential placeholders correctly", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce({
        id: "template-2",
        slug: "invoice_receipt",
        name: "invoice_receipt",
        whatsappDeviceId: "device-1",
        category: "UTILITY",
        languages: [
          {
            id: "lang-2",
            lang: "id",
            body: "Halo {{1}}, tagihan Anda {{2}}!",
          },
        ],
      } as any)

      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          templateName: "invoice_receipt",
          templateLanguage: "id",
          fields: ["Budi", "Rp 150.000"],
          deviceId: "device-1",
        })
      )
      expect(res.status).toBe(200)
      expect(mockMessageService.sendTemplateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          renderedBody: "Halo Budi, tagihan Anda Rp 150.000!",
          fields: ["Budi", "Rp 150.000"],
        })
      )
    })

    it("returns 422 if phone number is missing or invalid", async () => {
      const app = createTestApp()
      const resNoPhone = await app.handle(
        postJson("/messages", { message: "Hello" })
      )
      expect(resNoPhone.status).toBe(422)

      const resInvalidPhone = await app.handle(
        postJson("/messages", { phoneNumber: "invalid", message: "Hello" })
      )
      expect(resInvalidPhone.status).toBe(422)
    })

    it("returns 404 if template is not found", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce(null as any)
      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          template_name: "unknown_template",
        })
      )
      expect(res.status).toBe(404)
    })

    it("returns 422 if required template field is missing", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce({
        id: "template-1",
        slug: "otp_login",
        name: "otp_login",
        whatsappDeviceId: "device-1",
        languages: [
          {
            id: "lang-1",
            lang: "id",
            body: "Kode OTP: {{1}} dan {{2}}",
          },
        ],
      } as any)

      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          template_name: "otp_login",
          fields: ["1234"], // missing {{2}}
        })
      )
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.message).toContain("Template field {{2}} is required")
    })
    it("dispatches free-form text message when no template is provided", async () => {
      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          type: "text",
          message: "Halo dari Unified Dispatcher",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.waMessageId).toBe("wa-123")
      expect(mockMessageService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+6281234567890",
          type: "text",
          message: "Halo dari Unified Dispatcher",
        })
      )
    })

    it("returns 422 for free-form media message without mediaUrl", async () => {
      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          type: "image",
        })
      )
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.message).toContain("mediaUrl is required for media messages")
    })

    it("returns 422 for free-form location message without coordinates", async () => {
      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          type: "location",
        })
      )
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.message).toContain("latitude and longitude are required")
    })

    it("handles InsufficientBalanceError in template and free-form routes", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce({
        id: "template-1",
        slug: "otp_login",
        name: "otp_login",
        whatsappDeviceId: "device-1",
        languages: [{ id: "l1", lang: "id", body: "OTP: {{1}}" }],
      } as any)
      mockMessageService.sendTemplateMessage.mockRejectedValueOnce(
        new InsufficientBalanceError(new Decimal(500), new Decimal(100))
      )
      const app = createTestApp()
      const resTemplate = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          template_name: "otp_login",
          fields: ["123"],
          deviceId: "device-1",
        })
      )
      expect(resTemplate.status).toBe(402)

      mockMessageService.sendMessage.mockRejectedValueOnce(
        new InsufficientBalanceError(new Decimal(500), new Decimal(100))
      )
      const resFreeform = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          message: "test",
        })
      )
      expect(resFreeform.status).toBe(402)
    })

    it("handles QuotaExceededError and DailyLimitExceededError", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new QuotaExceededError("org-1", "device-1", "OUT", 1000, 1000)
      )
      const app = createTestApp()
      const resQuota = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          message: "test",
        })
      )
      expect(resQuota.status).toBe(429)

      mockMessageService.sendMessage.mockRejectedValueOnce(
        new DailyLimitExceededError("org-1", "device-1", 100, 100)
      )
      const resDaily = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          message: "test",
        })
      )
      expect(resDaily.status).toBe(429)
    })

    it("handles WhatsappSessionWindowClosedError for free-form message outside window", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new WhatsappSessionWindowClosedError()
      )
      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          message: "test",
        })
      )
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("WHATSAPP_TEMPLATE_REQUIRED")
    })

    it("handles WhatsappSendFailedError and generic errors", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new WhatsappSendFailedError("provider failed", "msg-failed-id")
      )
      const app = createTestApp()
      const resFailed = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          message: "test",
        })
      )
      expect(resFailed.status).toBe(502)

      mockMessageService.sendMessage.mockRejectedValueOnce(new Error("unknown"))
      const resGeneric = await app.handle(
        postJson("/messages", {
          phoneNumber: "+6281234567890",
          message: "test",
        })
      )
      expect(resGeneric.status).toBe(500)
    })
  })

  describe("POST /messages/internal", () => {
    it("creates internal message record in database", async () => {
      mockPrisma.whatsappConversation.findFirst.mockResolvedValueOnce({
        id: "conv-1",
        organizationId: "org-1",
      } as any)

      mockPrisma.whatsappMessage.create.mockResolvedValueOnce({
        id: "msg-internal-1",
        conversationId: "conv-1",
        direction: "OUTBOX",
        messageType: "text",
        body: "Internal note",
        mediaUrl: null,
        waMessageId: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages/internal", {
          conversationId: "conv-1",
          direction: "OUTBOX",
          messageType: "text",
          body: "Internal note",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.message.id).toBe("msg-internal-1")
    })
  })
  describe("PATCH /messages/:id", () => {
    // Note: Elysia t.Enum validation may require specific format
    // Skipping detailed tests - focus on routes that don't require body parsing
  })

  describe("GET /messages/:id", () => {
    it("returns 200 with message when found", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce({
        id: "msg-1",
        body: "Hello",
        conversation: { organizationId: "org-1" },
      } as any)

      const app = createTestApp()
      const res = await app.handle(authRequest("/messages/msg-1"))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.message).toBeDefined()
    })

    it("returns 404 when message not found", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce(null as any)

      const app = createTestApp()
      const res = await app.handle(authRequest("/messages/not-found"))

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe("NOT_FOUND")
    })
  })

  describe("DELETE /messages/:id", () => {
    it("returns 200 when message deleted", async () => {
      setMockAuthContext({
        type: "workos",
        userId: "user-1",
        email: "admin@example.com",
        organizationId: "org-1",
        orgRole: "owner",
        platformRole: "none",
      })
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce({
        id: "msg-1",
        conversation: { organizationId: "org-1" },
      } as any)

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/msg-1", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("returns 404 when message not found", async () => {
      setMockAuthContext({
        type: "workos",
        userId: "user-1",
        email: "admin@example.com",
        organizationId: "org-1",
        orgRole: "owner",
        platformRole: "none",
      })
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce(null as any)

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/not-found", {
          method: "DELETE",
        })
      )

      expect(res.status).toBe(404)
    })
  })

  describe("POST /messages/send", () => {
    it("returns 200 on successful send", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            message: "Hello",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        ok: true,
        jobId: "job-1",
        messageId: "msg-1",
        waMessageId: "wa-123",
        status: "sent",
      })
    })

    it("returns the Meta failure and records a failed audit event", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new WhatsappSendFailedError(
          "Recipient is outside the 24-hour window",
          "msg-failed"
        )
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            message: "Hello",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body).toEqual({
        ok: false,
        error: "WHATSAPP_SEND_FAILED",
        message: "Recipient is outside the 24-hour window",
        messageId: "msg-failed",
      })
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MESSAGE_FAILED",
          status: "FAILED",
          errorMessage: "Recipient is outside the 24-hour window",
        })
      )
    })

    it("requires a template outside the customer service window", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new WhatsappSessionWindowClosedError()
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            message: "Hello",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({
        ok: false,
        error: "WHATSAPP_TEMPLATE_REQUIRED",
        message:
          "Template required outside the 24-hour customer service window. " +
          "Use /messages/send-template.",
      })
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MESSAGE_FAILED",
          status: "FAILED",
          errorMessage: expect.stringContaining("Template required"),
        })
      )
    })

    it("returns 402 with balance details on insufficient balance (PGREEN-049)", async () => {
      const { Prisma } = await import("@prisma/client")
      const Decimal = Prisma.Decimal
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new InsufficientBalanceError(new Decimal(500), new Decimal(100))
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            message: "Hello",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.error).toBe("INSUFFICIENT_BALANCE")
      expect(body.balance).toBe("100")
      expect(body.estimatedCost).toBe("500")
    })

    it("returns 429 with resetAt on monthly quota exceeded (PGREEN-050)", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new QuotaExceededError("org-1", "device-1", "OUT", 1000, 1000)
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            message: "Hello",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error).toBe("MONTHLY_QUOTA_EXCEEDED")
      expect(body.resetAt).toBeDefined()
      expect(body.resetAt).toContain("T")
    })

    it("returns 429 with resetAt on daily quota exceeded (PGREEN-050)", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new DailyLimitExceededError("org-1", "device-1", 100, 100)
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            message: "Hello",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(429)

      const body = await res.json()
      expect(body.error).toBe("DAILY_QUOTA_EXCEEDED")
      expect(body.resetAt).toBeDefined()
      expect(body.resetAt).toContain("T")
    })

    it("returns 422 with UNSUPPORTED_DESTINATION_COUNTRY when destination country is not configured", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new UnsupportedDestinationCountryError("US", "+14155550100")
      )

      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages/send", {
          phoneNumber: "+14155550100",
          type: "text",
          message: "Hello world",
        })
      )
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("UNSUPPORTED_DESTINATION_COUNTRY")
      expect(body.country).toBe("US")
    })

    it("returns 500 for an unexpected send error", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new Error("unexpected provider failure")
      )

      const app = createTestApp()
      const res = await app.handle(
        postJson("/messages/send", {
          phoneNumber: "+1234567890",
          message: "Hello",
        })
      )

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Failed to send message",
      })
    })

    it("returns 400 when billing is not configured", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new Error("NO_BILLING_ACCOUNT")
      )

      const res = await createTestApp().handle(
        postJson("/messages/send", {
          phoneNumber: "+1234567890",
          message: "Hello",
        })
      )

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        ok: false,
        error: "BILLING_NOT_CONFIGURED",
        message: "No billing account configured for this organization.",
      })
    })

    it("returns 422 when message quota is insufficient", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new InsufficientQuotaError("Quota is exhausted")
      )

      const res = await createTestApp().handle(
        postJson("/messages/send", {
          phoneNumber: "+1234567890",
          message: "Hello",
        })
      )

      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({
        ok: false,
        error: "INSUFFICIENT_QUOTA",
        message: "Quota is exhausted",
      })
    })

    it("returns 422 with invalid phone number", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "abc",
            message: "Hello",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.message).toBe(
        "Phone number must be in E.164 format or Indonesian local format."
      )
    })
  })

  describe("POST /messages/send-interactive", () => {
    const interactiveBody = {
      phoneNumber: "+1234567890",
      interactive: {
        type: "button",
        body: { text: "test" },
        action: {
          buttons: [{ type: "reply", reply: { id: "b1", title: "OK" } }],
        },
      },
    }

    const sendInteractiveRequest = () =>
      createTestApp().handle(
        postJson("/messages/send-interactive", interactiveBody)
      )

    it("returns 200 on successful button interactive send", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-interactive", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            interactive: {
              type: "button",
              body: { text: "Do you need help?" },
              action: {
                buttons: [
                  { type: "reply", reply: { id: "btn_help", title: "Help" } },
                ],
              },
            },
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toEqual({
        ok: true,
        jobId: "job-1",
        messageId: "msg-1",
        waMessageId: "wa-123",
        status: "sent",
      })
    })

    it("returns 200 on successful list interactive send", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-interactive", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            interactive: {
              type: "list",
              body: { text: "Select one:" },
              action: {
                button: "View",
                sections: [
                  {
                    title: "Section 1",
                    rows: [{ id: "row_1", title: "Row 1" }],
                  },
                ],
              },
            },
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("returns 200 on successful CTA URL button interactive send", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-interactive", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            interactive: {
              type: "button",
              body: { text: "Visit our website" },
              action: {
                buttons: [
                  {
                    type: "cta_url",
                    cta_url: {
                      url: "https://example.com",
                      display_text: "Open Website",
                    },
                  },
                ],
              },
            },
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("rejects CTA URL button with missing url", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-interactive", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            interactive: {
              type: "button",
              body: { text: "Visit our website" },
              action: {
                buttons: [
                  {
                    type: "cta_url",
                    cta_url: { display_text: "Open Website" },
                  },
                ],
              },
            },
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
    })

    it("rejects missing body text", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-interactive", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            interactive: { type: "button" },
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
    })

    it("rejects invalid interactive type", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-interactive", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            interactive: {
              type: "flow",
              body: { text: "test" },
            },
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
    })

    it("returns 402 on insufficient balance", async () => {
      const { Prisma } = await import("@prisma/client")
      const Decimal = Prisma.Decimal
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new InsufficientBalanceError(new Decimal(500), new Decimal(100))
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-interactive", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            interactive: {
              type: "button",
              body: { text: "test" },
              action: {
                buttons: [{ type: "reply", reply: { id: "b1", title: "OK" } }],
              },
            },
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.error).toBe("INSUFFICIENT_BALANCE")
    })

    it("returns 422 when the interactive session window is closed", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new WhatsappSessionWindowClosedError()
      )

      const res = await sendInteractiveRequest()

      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({
        ok: false,
        error: "WHATSAPP_TEMPLATE_REQUIRED",
        message:
          "Template required outside the 24-hour customer service window. " +
          "Use /messages/send-template.",
      })
    })

    it("returns 502 when interactive sending fails at Meta", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new WhatsappSendFailedError(
          "Meta rejected interactive message",
          "wa-err"
        )
      )

      const res = await sendInteractiveRequest()

      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({
        ok: false,
        error: "WHATSAPP_SEND_FAILED",
        message: "Meta rejected interactive message",
        messageId: "wa-err",
      })
    })

    it("returns 429 on interactive monthly quota exceeded", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new QuotaExceededError("org-1", "device-1", "OUT", 1000, 1000)
      )

      const res = await sendInteractiveRequest()

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error).toBe("MONTHLY_QUOTA_EXCEEDED")
      expect(body.message).toContain("Limit: 1000, Used: 1000")
      expect(body.resetAt).toContain("T")
    })

    it("returns 429 on interactive daily quota exceeded", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new DailyLimitExceededError("org-1", "device-1", 100, 100)
      )

      const res = await sendInteractiveRequest()

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error).toBe("DAILY_QUOTA_EXCEEDED")
      expect(body.message).toContain("Limit: 100, Used: 100")
      expect(body.resetAt).toContain("T")
    })

    it("returns 500 for an unexpected interactive send error", async () => {
      mockMessageService.sendMessage.mockRejectedValueOnce(
        new Error("unexpected interactive provider failure")
      )

      const res = await sendInteractiveRequest()

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Failed to send interactive message",
      })
    })

    it("returns 422 with invalid phone number", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-interactive", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "abc",
            interactive: {
              type: "button",
              body: { text: "test" },
              action: {
                buttons: [{ type: "reply", reply: { id: "b1", title: "OK" } }],
              },
            },
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.message).toBe(
        "Phone number must be in E.164 format or Indonesian local format."
      )
    })
  })

  describe("POST /send-template", () => {
    const mockTemplate = {
      id: "tpl-1",
      organizationId: "org-1",
      name: "hello_world",
      slug: "hello-world",
      syncStatus: "SYNCED",
      metaStatus: "APPROVED",
      whatsappDeviceId: "device-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      languages: [
        {
          id: "lang-1",
          lang: "en",
          status: "APPROVED",
          metaStatus: "APPROVED",
          header: null,
          body: "Hello {{1}}, welcome to {{2}}!",
          footer: null,
          buttons: null,
          example: null,
          templateId: "tpl-1",
        },
      ],
    }
    const templateBody = {
      phoneNumber: "+1234567890",
      templateId: "tpl-1",
      templateLanguage: "en",
      fields: ["John", "Acme Corp"],
      deviceId: "device-1",
    }

    const sendTemplateRequest = () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce(
        mockTemplate as any
      )
      return createTestApp().handle(
        postJson("/messages/send-template", templateBody)
      )
    }

    it("sends template message successfully with deviceId", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce(
        mockTemplate as any
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-template", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            templateId: "tpl-1",
            templateLanguage: "en",
            fields: ["John", "Acme Corp"],
            deviceId: "device-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        ok: true,
        jobId: "job-template-1",
        messageId: "mock-id",
        waMessageId: "wa-template-1",
        status: "sent",
      })
      expect(mockPrisma.whatsappTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "tpl-1" }),
        })
      )
      expect(mockMessageService.sendTemplateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          phoneNumber: "+1234567890",
          deviceId: "device-1",
          templateName: "hello-world",
          templateLanguage: "en",
          fields: ["John", "Acme Corp"],
        })
      )
    })

    it("returns the Meta failure and records a failed audit event", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce(
        mockTemplate as any
      )
      mockMessageService.sendTemplateMessage.mockRejectedValueOnce(
        new WhatsappSendFailedError(
          "Template is not approved for this phone number",
          "msg-template-failed"
        )
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-template", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            templateId: "tpl-1",
            templateLanguage: "en",
            fields: ["John", "Acme Corp"],
            deviceId: "device-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body).toEqual({
        ok: false,
        error: "WHATSAPP_SEND_FAILED",
        message: "Template is not approved for this phone number",
        messageId: "msg-template-failed",
      })
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MESSAGE_FAILED",
          status: "FAILED",
          errorMessage: "Template is not approved for this phone number",
        })
      )
    })

    it("returns 402 with balance details on insufficient balance", async () => {
      const { Prisma } = await import("@prisma/client")
      mockMessageService.sendTemplateMessage.mockRejectedValueOnce(
        new InsufficientBalanceError(
          new Prisma.Decimal(500),
          new Prisma.Decimal(100)
        )
      )

      const res = await sendTemplateRequest()

      expect(res.status).toBe(402)
      expect(await res.json()).toEqual({
        ok: false,
        error: "INSUFFICIENT_BALANCE",
        message: "Insufficient balance for WhatsApp messaging.",
        balance: "100",
        estimatedCost: "500",
      })
    })

    it("returns 429 on monthly quota exceeded", async () => {
      mockMessageService.sendTemplateMessage.mockRejectedValueOnce(
        new QuotaExceededError("org-1", "device-1", "OUT", 1000, 1000)
      )

      const res = await sendTemplateRequest()

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error).toBe("MONTHLY_QUOTA_EXCEEDED")
      expect(body.message).toContain("Limit: 1000, Used: 1000")
      expect(body.resetAt).toContain("T")
    })

    it("returns 429 on daily quota exceeded", async () => {
      mockMessageService.sendTemplateMessage.mockRejectedValueOnce(
        new DailyLimitExceededError("org-1", "device-1", 100, 100)
      )

      const res = await sendTemplateRequest()

      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error).toBe("DAILY_QUOTA_EXCEEDED")
      expect(body.message).toContain("Limit: 100, Used: 100")
      expect(body.resetAt).toContain("T")
    })

    it("returns 500 for an unexpected template send error", async () => {
      mockMessageService.sendTemplateMessage.mockRejectedValueOnce(
        new Error("unexpected template provider failure")
      )

      const res = await sendTemplateRequest()

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Failed to send template message",
      })
    })

    it("returns 400 when template billing is not configured", async () => {
      mockMessageService.sendTemplateMessage.mockRejectedValueOnce(
        new Error("BILLING_ACCOUNT_NOT_FOUND")
      )

      const res = await sendTemplateRequest()

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        ok: false,
        error: "BILLING_NOT_CONFIGURED",
        message: "No billing account configured for this organization.",
      })
    })

    it("returns 422 when template quota is insufficient", async () => {
      mockMessageService.sendTemplateMessage.mockRejectedValueOnce(
        new InsufficientQuotaError("Template quota is exhausted")
      )

      const res = await sendTemplateRequest()

      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({
        ok: false,
        error: "INSUFFICIENT_QUOTA",
        message: "Template quota is exhausted",
      })
    })

    it("returns 422 when deviceId is missing", async () => {
      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-template", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            templateId: "tpl-1",
            templateLanguage: "en",
            fields: ["John", "Acme Corp"],
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      // Elysia schema validation rejects missing required deviceId
      expect(res.status).toBe(422)
    })

    it("returns 422 when template does not match device", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce(
        mockTemplate as any
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-template", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            templateId: "tpl-1",
            templateLanguage: "en",
            fields: ["John", "Acme Corp"],
            deviceId: "device-2",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.message).toBe(
        "Template is not available for the selected device."
      )
    })

    it("returns 404 for non-existent template", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce(null as any)

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-template", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            templateId: "non-existent",
            templateLanguage: "en",
            fields: ["John"],
            deviceId: "device-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns 422 for non-existent language", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce({
        ...mockTemplate,
        languages: [
          {
            ...mockTemplate.languages[0],
            lang: "es",
          },
        ],
      } as any)

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-template", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            templateId: "tpl-1",
            templateLanguage: "en",
            fields: ["John"],
            deviceId: "device-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.message).toBe("Template language not found.")
    })

    it("returns 422 for missing required field", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce(
        mockTemplate as any
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-template", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "+1234567890",
            templateId: "tpl-1",
            templateLanguage: "en",
            fields: [],
            deviceId: "device-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.message).toBe("Template field {{1}} is required.")
    })

    it("normalizes Indonesian local phone number to E.164", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce(
        mockTemplate as any
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-template", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "085708296482",
            templateId: "tpl-1",
            templateLanguage: "en",
            fields: ["John", "Acme Corp"],
            deviceId: "device-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(200)
      expect(mockMessageService.sendTemplateMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneNumber: "+6285708296482",
        })
      )
    })

    it("returns 422 with invalid phone number", async () => {
      mockPrisma.whatsappTemplate.findFirst.mockResolvedValueOnce(
        mockTemplate as any
      )

      const app = createTestApp()
      const res = await app.handle(
        authRequest("/messages/send-template", {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: "abc",
            templateId: "tpl-1",
            templateLanguage: "en",
            fields: ["John", "Acme Corp"],
            deviceId: "device-1",
          }),
          headers: { "Content-Type": "application/json" },
        })
      )

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error).toBe("VALIDATION_ERROR")
      expect(body.message).toBe(
        "Phone number must be in E.164 format or Indonesian local format."
      )
    })
  })

  describe("GET /messages/:id/media", () => {
    beforeEach(() => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValue(null as any)
    })

    it("returns media URL for non-Meta media", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValue({
        id: "msg-1",
        mediaUrl: "https://example.com/image.jpg",
        conversation: {
          organizationId: "org-1",
          whatsappDevice: { id: "device-1" },
        },
      } as any)

      const app = createTestApp()
      const res = await app.handle(authRequest("/messages/msg-1/media"))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.mediaUrl).toBe("https://example.com/image.jpg")
    })

    it("returns download URL for Meta media", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValue({
        id: "msg-1",
        mediaUrl: "__media:meta-id-123",
        conversation: {
          organizationId: "org-1",
          whatsappDevice: {
            id: "device-1",
            tokenEncrypted: "token",
          },
        },
      } as any)

      const app = createTestApp()
      const res = await app.handle(authRequest("/messages/msg-1/media"))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.mediaId).toBe("meta-id-123")
      expect(body.downloadUrl).toContain("/api/whatsapp/media/")
    })

    it("returns 404 when message not found", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValue(null as any)

      const app = createTestApp()
      const res = await app.handle(authRequest("/messages/not-found/media"))

      expect(res.status).toBe(404)
    })
  })
  describe("GET /messages/journey/:waMessageId", () => {
    it("returns a chronological timeline and resolves the actor once", async () => {
      const messageCreatedAt = new Date("2026-08-20T12:03:00.000Z")
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce({
        id: "msg-journey",
        conversationId: "conv-1",
        direction: "OUTBOX",
        messageType: "text",
        body: "Hello",
        mediaUrl: null,
        waMessageId: "wamid.123",
        metadata: null,
        createdAt: messageCreatedAt,
        conversation: {
          contactPhone: "+628111111111",
          whatsappDevice: {
            id: "device-1",
            phoneNumber: "+6281234567890",
            whatsappProfile: null,
          },
        },
        statusHistory: [
          {
            id: "status-1",
            status: "DELIVERED",
            timestamp: new Date("2026-08-20T12:04:00.000Z"),
            createdAt: new Date("2026-08-20T12:04:00.000Z"),
            error: null,
          },
        ],
      })
      mockPrisma.whatsappBillingLedger.findFirst.mockResolvedValueOnce({
        id: "ledger-1",
        status: "RECORDED",
        createdAt: new Date("2026-08-20T12:02:00.000Z"),
        category: "UTILITY",
        quotaKey: "device-1",
        phoneNumber: "+628111111111",
      })
      mockPrisma.whatsappAuditLog.findFirst.mockResolvedValueOnce({
        adminId: "user-1",
        action: "MESSAGE_SENT",
        ip: null,
        userAgent: null,
        message: "Message sent",
        details: { waMessageId: "wamid.123" },
        createdAt: new Date("2026-08-20T12:01:00.000Z"),
      })
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValueOnce([
        {
          id: "webhook-1",
          eventType: "status_update",
          processingStatus: "SUCCESS",
          createdAt: new Date("2026-08-20T12:05:00.000Z"),
          errorMessage: null,
        },
      ])
      mockGetCachedUser.mockResolvedValueOnce({
        name: null,
        email: "actor@example.com",
      })

      const response = await createTestApp().handle(
        authRequest("/messages/journey/wamid.123")
      )
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.timeline.map((step: { id: string }) => step.id)).toEqual(
        [
          "step-billing-ledger-1",
          "step-initiation",
          "status-1",
          "step-webhook-webhook-1",
        ]
      )
      expect(body.data.audit.actorName).toBe("actor@example.com")
      expect(mockGetCachedUser).toHaveBeenCalledTimes(1)
      expect(mockPrisma.whatsappAuditLog.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: "org-1",
            details: { path: ["waMessageId"], equals: "wamid.123" },
          },
        })
      )
    })

    it("returns 401 when unauthenticated", async () => {
      mockResolveAuthContext.current = null
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/messages/journey/wamid.123")
      )
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe("UNAUTHORIZED")
    })

    it("returns 403 when organization is missing", async () => {
      mockResolveAuthContext.current = {
        type: "workos",
        userId: "user-1",
        organizationId: null,
        orgRole: "admin",
        platformRole: "none",
      }
      const app = createTestApp()
      const res = await app.handle(
        new Request("http://localhost/messages/journey/wamid.123")
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("FORBIDDEN")
    })

    it("returns 404 when no records are found across all sources", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce(null as never)
      mockPrisma.whatsappBillingLedger.findFirst.mockResolvedValueOnce(
        null as never
      )
      mockPrisma.whatsappAuditLog.findFirst.mockResolvedValueOnce(null as never)
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValueOnce([])

      const response = await createTestApp().handle(
        authRequest("/messages/journey/wamid.unknown")
      )
      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe("NOT_FOUND")
    })

    it("returns journey data from webhook events only and applies fallbacks", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce(null as never)
      mockPrisma.whatsappBillingLedger.findFirst.mockResolvedValueOnce(
        null as never
      )
      mockPrisma.whatsappAuditLog.findFirst.mockResolvedValueOnce(null as never)
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValueOnce([
        {
          id: "webhook-only-1",
          eventType: "inbound_message",
          processingStatus: "RECEIVED",
          createdAt: new Date("2026-08-20T12:00:00.000Z"),
          errorMessage: "Failed to dispatch",
        },
      ])

      const response = await createTestApp().handle(
        authRequest("/messages/journey/wamid%3Ainbound%3A123")
      )
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.data.message.waMessageId).toBe("wamid:inbound:123")
      expect(body.data.message.direction).toBe("OUTBOX")
      expect(body.data.device).toBeNull()
      expect(body.data.contact).toBeNull()
      expect(body.data.billing).toBeNull()
      expect(body.data.audit).toBeNull()
      expect(body.data.timeline).toHaveLength(2)
      const initiationStep = body.data.timeline.find(
        (step: { id: string }) => step.id === "step-initiation"
      )
      const webhookStep = body.data.timeline.find(
        (step: { id: string }) => step.id === "step-webhook-webhook-only-1"
      )
      expect(initiationStep?.description).toBe("Webhook event received")
      expect(webhookStep?.error).toBe("Failed to dispatch")
      expect(mockPrisma.whatsappWebhookEvent.findMany).toHaveBeenCalledWith({
        where: {
          waMessageId: "wamid:inbound:123",
          organizationId: "org-1",
        },
        orderBy: { createdAt: "asc" },
      })
    })

    it("resolves audit-only journey with console UI origin and phone fallback", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce(null as never)
      mockPrisma.whatsappBillingLedger.findFirst.mockResolvedValueOnce(
        null as never
      )
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValueOnce([])
      mockPrisma.whatsappAuditLog.findFirst.mockResolvedValueOnce({
        adminId: null,
        action: "BROADCAST_SENT",
        ip: "127.0.0.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        message: "Broadcast queued",
        details: {
          waMessageId: "wamid.audit.broadcast",
          phoneNumber: "+628199999999",
        },
        createdAt: new Date("2026-08-20T12:00:00.000Z"),
      })

      const response = await createTestApp().handle(
        authRequest("/messages/journey/wamid.audit.broadcast")
      )
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.contact.phoneNumber).toBe("+628199999999")
      expect(body.data.audit.actorName).toBe("System")
      expect(body.data.audit.origin).toBe("Console UI")
    })

    it("handles broadcast campaign origin, device name profile, and status history errors/null timestamp", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce({
        id: "msg-journey-2",
        conversationId: "conv-1",
        direction: "OUTBOX",
        messageType: "text",
        body: "Campaign message",
        mediaUrl: null,
        waMessageId: "wamid.campaign.1",
        metadata: null,
        createdAt: new Date("2026-08-20T12:00:00.000Z"),
        conversation: {
          contactPhone: "+628111111111",
          whatsappDevice: {
            id: "device-1",
            phoneNumber: "+6281234567890",
            whatsappProfile: { name: "Official Support" },
          },
        },
        statusHistory: [
          {
            id: "status-err-1",
            status: "FAILED",
            timestamp: null,
            createdAt: new Date("2026-08-20T12:01:00.000Z"),
            error: "Destination unreachable",
          },
        ],
      })
      mockPrisma.whatsappBillingLedger.findFirst.mockResolvedValueOnce(
        null as never
      )
      mockPrisma.whatsappWebhookEvent.findMany.mockResolvedValueOnce([])
      mockPrisma.whatsappAuditLog.findFirst.mockResolvedValueOnce({
        adminId: "anon_admin_without_user",
        action: "BROADCAST_SENT",
        ip: null,
        userAgent: null,
        message: "Campaign queued",
        details: { waMessageId: "wamid.campaign.1" },
        createdAt: new Date("2026-08-20T11:59:00.000Z"),
      })
      mockGetCachedUser.mockResolvedValueOnce(null)

      const response = await createTestApp().handle(
        authRequest("/messages/journey/wamid.campaign.1")
      )
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.data.device.name).toBe("Official Support")
      expect(body.data.audit.origin).toBe("Broadcast Campaign")
      expect(body.data.audit.actorName).toBe("anon_admin")
      expect(body.data.timeline[1].error).toBe("Destination unreachable")
      expect(body.data.timeline[1].description).toBe(
        "Error: Destination unreachable"
      )
    })
  })
})
