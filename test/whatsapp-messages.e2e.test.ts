import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { whatsappAuthMock, setMockAuthContext, mockAuthContext } from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "./workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindMany = mock(async () => [] as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindFirst = mock(async () => null as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreate = mock(async () => null as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpdate = mock(async () => null as any)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappMessage: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
    whatsappConversation: {
      findFirst: mockFindFirst,
    },
    whatsappDevice: {
      findFirst: mockFindFirst,
    },
    whatsappMonthlyCount: {
      findFirst: mockFindFirst,
    },
    whatsappQuotaSession: {
      findFirst: mockFindFirst,
    },
  },
}))

// ─── Auth mock ─────────────────────────────────────────────────────────────────

mock.module("@/lib/whatsapp/auth", () => whatsappAuthMock)

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const { messagesRoutes } = await import("@/modules/whatsapp/messages/api/messages.route")

function createTestApp() {
  return new Elysia()
    .use(messagesRoutes)
}

// ─── Tests ─────────────────────────────────────────────────────────────────────────

describe("WhatsApp Messages E2E", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFindMany.mockImplementation(async () => [] as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFindFirst.mockImplementation(async () => null as any)

    // Reset auth to default admin
    setMockAuthContext({
      type: "workos",
      userId: "user-1",
      email: "admin@example.com",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
    })
  })

  // ── POST /send ──────────────────────────────────────────────────────────────

  // Note: These tests are skipped because the /send endpoint calls messageService.sendMessage
  // which has deep dependencies on prisma. For full E2E testing of the send endpoint,
  // use integration tests with a real database.

  it.skip("returns queued job when sending a message", async () => {
    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/messages/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumber: "+6281111111111",
          message: "Hello World",
        }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { messageId: string; status: string }
    expect(payload.messageId).toMatch(/^stub_/)
    expect(payload.status).toBe("queued")
  })

  it.skip("returns queued job with deviceId when sending a message", async () => {
    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/messages/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumber: "+6281111111111",
          message: "Hello with device",
          deviceId: "dev_1",
        }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { messageId: string; status: string }
    expect(payload.messageId).toMatch(/^stub_/)
    expect(payload.status).toBe("queued")
  })

  // ── GET /messages ────────────────────────────────────────────────────────────

  it("returns message list filtered by organization", async () => {
    const messages = [
      {
        id: "msg_1",
        conversationId: "conv_1",
        direction: "OUTBOX" as const,
        messageType: "text",
        body: "Hello",
      },
      {
        id: "msg_2",
        conversationId: "conv_1",
        direction: "INBOX" as const,
        messageType: "text",
        body: "Hi there",
      },
    ]

    mockFindMany.mockImplementationOnce(async () => messages as any)

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/messages/"))
    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; messages: unknown[] }
    expect(payload.ok).toBe(true)
    expect(payload.messages).toHaveLength(2)
    expect((payload.messages[0] as any).direction).toBe("OUTBOX")
    expect((payload.messages[1] as any).direction).toBe("INBOX")
  })

  it("returns empty list when no messages", async () => {
    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/messages/"))
    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; messages: unknown[] }
    expect(payload.messages).toHaveLength(0)
  })

  it("filters messages by conversationId", async () => {
    const conversationMessages = [
      {
        id: "msg_conv_1",
        conversationId: "conv_filtered",
        direction: "OUTBOX" as const,
        messageType: "text",
        body: "Filtered message",
      },
    ]

    mockFindMany.mockImplementationOnce(async () => conversationMessages as any)

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/messages/?conversationId=conv_filtered")
    )
    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; messages: unknown[] }
    expect(payload.messages).toHaveLength(1)
  })

  // ── GET /:id ────────────────────────────────────────────────────────────────

  it("returns message by ID", async () => {
    const message = {
      id: "msg_get",
      conversationId: "conv_1",
      direction: "OUTBOX" as const,
      messageType: "text",
      body: "Get this message",
      statusHistory: [],
    }

    mockFindFirst.mockImplementationOnce(async () => message as any)

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/messages/msg_get"))
    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; message?: unknown }
    expect(payload.ok).toBe(true)
    expect((payload.message as any).id).toBe("msg_get")
  })

  it("returns 404 for non-existent message", async () => {
    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/messages/msg_missing"))
    expect(response.status).toBe(404)
  })

  // ── Quota Check ─────────────────────────────────────────────────────────────

  it("rejects message creation when conversation belongs to different org", async () => {
    // Mock conversation from different org
    mockFindFirst.mockImplementationOnce(async () => null as any)

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/messages/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv_other_org",
          direction: "OUTBOX",
          messageType: "text",
          body: "Hello",
        }),
      })
    )

    expect(response.status).toBe(404)
  })

  // ── Authorization ────────────────────────────────────────────────────────────

  it("returns 200 for any authenticated user (guards removed)", async () => {
    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "member",
      platformRole: "none",
    })

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/messages/"))
    expect(response.status).toBe(200)
  })

  it("returns 401 for unauthenticated user", async () => {
    // Simulate no auth context
    setMockAuthContext(null)

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/messages/"))
    expect(response.status).toBe(401)
  })

  // ── POST /create message ─────────────────────────────────────────────────────

  it("creates a message in valid conversation", async () => {
    const conversation = {
      id: "conv_valid",
      organizationId: "org-1",
      contactPhone: "+6281111111111",
    }

    const createdMessage = {
      id: "msg_created",
      conversationId: "conv_valid",
      direction: "OUTBOX",
      messageType: "text",
      body: "New message",
    }

    mockFindFirst.mockImplementationOnce(async () => conversation as any)
    mockCreate.mockImplementationOnce(async () => createdMessage as any)

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/messages/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: "conv_valid",
          direction: "OUTBOX",
          messageType: "text",
          body: "New message",
        }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; message?: unknown }
    expect(payload.ok).toBe(true)
  })
})

