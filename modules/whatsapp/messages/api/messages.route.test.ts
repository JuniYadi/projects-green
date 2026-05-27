import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

// Mock InsufficientQuotaError
class InsufficientQuotaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InsufficientQuotaError"
  }
}

// Mock prisma
const mockPrisma = {
  whatsappMessage: {
    findMany: mock(async () => [{ id: "msg-1" }]),
    findFirst: mock(async () => ({
      id: "msg-1",
      body: "Test message",
      conversation: { organizationId: "org-1" },
    })),
    create: mock(async () => ({ id: "msg-new" })),
    update: mock(async () => ({ id: "msg-1", body: "Updated body" })),
    delete: mock(async () => ({ id: "msg-1" })),
  },
  whatsappConversation: {
    findFirst: mock(async () => ({ id: "conv-1", organizationId: "org-1" })),
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
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

mock.module("../messages.service", () => ({
  messageService: mockMessageService,
}))

mock.module("../quota.service", () => ({
  InsufficientQuotaError,
}))

mock.module("@/lib/whatsapp/auth", () => {
  const mockAuth = {
    type: "workos" as const,
    userId: "user-1",
    email: "admin@example.com",
    organizationId: "org-1",
    tenantRole: "admin" as const,
    platformRole: "none" as const,
  }

  const plugin = new Elysia({ name: "whatsapp.auth" }).derive(() => ({
    whatsappAuth: mockAuth,
  }))

  const guard = (route: Function) => async (ctx: any) => {
    ctx.whatsappAuth = mockAuth
    return route(ctx)
  }

  return { whatsappAuthPlugin: plugin, guardTenantAdmin: guard }
})

const { messagesRoutes } = await import("./messages.route")

describe("messagesRoutes", () => {
  beforeEach(() => {
    mockPrisma.whatsappMessage.findMany.mockReset()
    mockPrisma.whatsappMessage.findFirst.mockReset()
    mockPrisma.whatsappMessage.create.mockReset()
    mockPrisma.whatsappMessage.update.mockReset()
    mockPrisma.whatsappMessage.delete.mockReset()
    mockPrisma.whatsappConversation.findFirst.mockReset()
    mockMessageService.sendMessage.mockReset()

    mockPrisma.whatsappMessage.findMany.mockResolvedValue([{ id: "msg-1" }] as any)
    mockPrisma.whatsappMessage.findFirst.mockResolvedValue({
      id: "msg-1",
      body: "Test message",
      conversation: { organizationId: "org-1" },
    } as any)
    mockMessageService.sendMessage.mockResolvedValue({
      jobId: "job-1",
      messageId: "msg-1",
      waMessageId: "wa-123",
      status: "sent",
    })
  })

  describe("GET /messages", () => {
    it("returns 200 with messages array", async () => {
      const app = new Elysia().use(messagesRoutes).compile()
      const res = await app.handle(
        new Request("http://localhost/messages", {
          headers: { Authorization: "Bearer test" },
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("returns 200 with filtered messages", async () => {
      const app = new Elysia().use(messagesRoutes).compile()
      const res = await app.handle(
        new Request("http://localhost/messages?conversationId=conv-1&direction=OUTBOX", {
          headers: { Authorization: "Bearer test" },
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.messages).toBeDefined()
    })
  })

  describe("GET /messages/:id", () => {
    it("returns 200 with message when found", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce({
        id: "msg-1",
        body: "Hello",
        conversation: { organizationId: "org-1" },
      } as any)

      const app = new Elysia().use(messagesRoutes).compile()
      const res = await app.handle(
        new Request("http://localhost/messages/msg-1", {
          headers: { Authorization: "Bearer test" },
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.message).toBeDefined()
    })

    it("returns 404 when message not found", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce(null)

      const app = new Elysia().use(messagesRoutes).compile()
      const res = await app.handle(
        new Request("http://localhost/messages/not-found", {
          headers: { Authorization: "Bearer test" },
        })
      )

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error).toBe("NOT_FOUND")
    })
  })

  describe("DELETE /messages/:id", () => {
    it("returns 200 when message deleted", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce({
        id: "msg-1",
        conversation: { organizationId: "org-1" },
      } as any)

      const app = new Elysia().use(messagesRoutes).compile()
      const res = await app.handle(
        new Request("http://localhost/messages/msg-1", {
          method: "DELETE",
          headers: { Authorization: "Bearer test" },
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it("returns 404 when message not found", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce(null)

      const app = new Elysia().use(messagesRoutes).compile()
      const res = await app.handle(
        new Request("http://localhost/messages/not-found", {
          method: "DELETE",
          headers: { Authorization: "Bearer test" },
        })
      )

      expect(res.status).toBe(404)
    })
  })

  describe("GET /messages/:id/media", () => {
    it("returns media URL for non-Meta media", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce({
        id: "msg-1",
        mediaUrl: "https://example.com/image.jpg",
        conversation: {
          organizationId: "org-1",
          whatsappDevice: { id: "device-1" },
        },
      } as any)

      const app = new Elysia().use(messagesRoutes).compile()
      const res = await app.handle(
        new Request("http://localhost/messages/msg-1/media", {
          headers: { Authorization: "Bearer test" },
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.mediaUrl).toBe("https://example.com/image.jpg")
    })

    it("returns download URL for Meta media", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce({
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

      const app = new Elysia().use(messagesRoutes).compile()
      const res = await app.handle(
        new Request("http://localhost/messages/msg-1/media", {
          headers: { Authorization: "Bearer test" },
        })
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.mediaId).toBe("meta-id-123")
      expect(body.downloadUrl).toContain("/api/whatsapp/media/")
    })

    it("returns 404 when message not found", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce(null)

      const app = new Elysia().use(messagesRoutes).compile()
      const res = await app.handle(
        new Request("http://localhost/messages/not-found/media", {
          headers: { Authorization: "Bearer test" },
        })
      )

      expect(res.status).toBe(404)
    })
  })
})