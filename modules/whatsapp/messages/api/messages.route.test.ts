import { describe, expect, it, mock, beforeEach } from "bun:test"
import { Elysia } from "elysia"

import {
  whatsappAuthMock,
  setMockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"
import { InsufficientQuotaError } from "../quota.service"

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

mock.module("@/modules/whatsapp/messages/messages.service", () => ({
  messageService: mockMessageService,
}))

mock.module("@/modules/whatsapp/messages/quota.service", () => ({
  InsufficientQuotaError,
}))

mock.module("@/lib/whatsapp/auth", () => whatsappAuthMock)

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

describe("messagesRoutes", () => {
  beforeEach(() => {
    setMockAuthContext({
      type: "workos",
      userId: "user-1",
      email: "admin@example.com",
      organizationId: "org-1",
      tenantRole: "admin",
      platformRole: "none",
    })

    mockPrisma.whatsappMessage.findMany.mockClear()
    mockPrisma.whatsappMessage.findFirst.mockClear()
    mockPrisma.whatsappMessage.create.mockClear()
    mockPrisma.whatsappMessage.update.mockClear()
    mockPrisma.whatsappMessage.delete.mockClear()
    mockPrisma.whatsappConversation.findFirst.mockClear()
    mockMessageService.sendMessage.mockClear()

    mockPrisma.whatsappMessage.findMany.mockResolvedValue([{ id: "msg-1" }] as any)
    mockPrisma.whatsappMessage.findFirst.mockResolvedValue({
      id: "msg-1",
      body: "Test message",
      conversation: { organizationId: "org-1" },
    } as any)
    mockPrisma.whatsappMessage.create.mockResolvedValue({ id: "msg-new" } as any)
    mockPrisma.whatsappMessage.update.mockResolvedValue({ id: "msg-1", body: "Updated body" } as any)
    mockPrisma.whatsappMessage.delete.mockResolvedValue({ id: "msg-1" } as any)
    mockPrisma.whatsappConversation.findFirst.mockResolvedValue({ id: "conv-1", organizationId: "org-1" } as any)
    mockMessageService.sendMessage.mockResolvedValue({
      jobId: "job-1",
      messageId: "msg-1",
      waMessageId: "wa-123",
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

      const app = createTestApp()
      const res = await app.handle(authRequest("/messages/msg-1/media"))

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

      const app = createTestApp()
      const res = await app.handle(authRequest("/messages/msg-1/media"))

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.mediaId).toBe("meta-id-123")
      expect(body.downloadUrl).toContain("/api/whatsapp/media/")
    })

    it("returns 404 when message not found", async () => {
      mockPrisma.whatsappMessage.findFirst.mockResolvedValueOnce(null as any)

      const app = createTestApp()
      const res = await app.handle(authRequest("/messages/not-found/media"))

      expect(res.status).toBe(404)
    })
  })
})
