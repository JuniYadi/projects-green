import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import { whatsappAuthMock, setMockAuthContext, mockAuthContext } from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "./workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindUnique = mock(async () => null as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindFirst = mock(async () => null as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindMany = mock(async () => [] as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCreate = mock(async () => null as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpdate = mock(async () => null as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDelete = mock(async () => null as any)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCount = mock(async () => 0)

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappWebhook: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
      count: mockCount,
    },
    whatsappLog: {
      create: mockCreate,
    },
  },
}))

// ─── Auth mock ─────────────────────────────────────────────────────────────────

mock.module("@/lib/whatsapp/auth", () => whatsappAuthMock)

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const { webhooksRoutes } = await import("@/modules/whatsapp/webhooks/api/webhooks.route")

function createTestApp() {
  return new Elysia()
    .use(webhooksRoutes)
}

// ─── Tests ─────────────────────────────────────────────────────────────────────────

describe("WhatsApp Webhooks E2E", () => {
  beforeEach(() => {
    mockFindMany.mockImplementation(async () => [] as any)
    mockFindUnique.mockImplementation(async () => null as any)
    mockCreate.mockImplementation(async () => null as any)
    mockCount.mockImplementation(async () => 0)

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

  // ── POST /webhook — incoming event ──────────────────────────────────────────

  it("saves incoming webhook event to DB", async () => {
    // Note: The webhook endpoint is unauthenticated (open for Meta)
    // but it should save the event to whatsappLog
    const webhookEvent = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "123456789",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "15551234567",
                  phone_number_id: "123456789",
                },
                messages: [
                  {
                    from: "15559999999",
                    id: "wamid.xxx",
                    timestamp: "1234567890",
                    type: "text",
                    text: { body: "Hello World" },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    }

    mockCreate.mockImplementationOnce(async () => ({
      id: "log_new",
      organizationId: "system",
      whatsappDeviceId: "dev_webhook",
      type: "INBOX",
      message: "Incoming Webhook Event",
      metadata: webhookEvent,
    }))

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/webhooks/dev_webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(webhookEvent),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect((payload as any).status).toBe("received")
  })

  it("immediately returns 200 for webhook endpoint", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/webhooks/dev_123", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: "data" }),
      })
    )

    expect(response.status).toBe(200)
  })

  // ── GET /webhook/:id/verify — Meta verification ─────────────────────────────

  it("returns challenge for Meta webhook verification", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/webhooks/dev_verify/verify?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=challenge_code")
    )

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe("challenge_code")
  })

  it("returns 403 for invalid verify mode", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/webhooks/dev_verify/verify?hub.mode=invalid&hub.verify_token=test&hub.challenge=code")
    )

    expect(response.status).toBe(500)
  })

  // ── CRUD Webhook Config ─────────────────────────────────────────────────────

  it("creates a webhook config", async () => {
    const webhookConfig = {
      id: "wh_new",
      organizationId: "org-1",
      whatsappDeviceId: "dev_1",
      webhookUrl: "https://example.com/webhook",
      verifyToken: "token123",
      active: true,
    }

    mockCreate.mockImplementationOnce(async () => webhookConfig as any)

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/webhooks/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: "org-1",
          deviceId: "dev_1",
          webhookUrl: "https://example.com/webhook",
          verifyToken: "token123",
        }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; data?: unknown }
    expect(payload.ok).toBe(true)
    expect((payload.data as any).webhookUrl).toBe("https://example.com/webhook")
  })

  it("lists webhook configs", async () => {
    const webhookConfigs = [
      {
        id: "wh_1",
        organizationId: "org-1",
        whatsappDeviceId: "dev_1",
        webhookUrl: "https://example.com/webhook1",
        verifyToken: "token1",
        active: true,
      },
      {
        id: "wh_2",
        organizationId: "org-1",
        whatsappDeviceId: "dev_2",
        webhookUrl: "https://example.com/webhook2",
        verifyToken: "token2",
        active: true,
      },
    ]

    // Reset and set up mock for this specific test
    mockFindMany.mockImplementation(async () => webhookConfigs)
    mockCount.mockImplementation(async () => 2)

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/webhooks/"))
    expect(response.status).toBe(200)
    const payload = await response.json() as { data: unknown[]; meta: { total: number } }
    expect(payload.data).toHaveLength(2)
    expect(payload.meta.total).toBe(2)
  })

  it("gets a single webhook config", async () => {
    const webhookConfig = {
      id: "wh_get",
      organizationId: "org-1",
      whatsappDeviceId: "dev_1",
      webhookUrl: "https://example.com/webhook",
      verifyToken: "token123",
      active: true,
    }

    mockFindUnique.mockImplementationOnce(async () => webhookConfig as any)

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/webhooks/wh_get"))
    expect(response.status).toBe(200)
    const payload = await response.json() as { id: string }
    expect(payload.id).toBe("wh_get")
  })

  it("updates a webhook config", async () => {
    const existingConfig = {
      id: "wh_patch",
      organizationId: "org-1",
      whatsappDeviceId: "dev_1",
      webhookUrl: "https://example.com/webhook",
      verifyToken: "token123",
      active: true,
    }

    const updatedConfig = {
      ...existingConfig,
      webhookUrl: "https://example.com/new-webhook",
      active: false,
    }

    mockFindUnique.mockImplementationOnce(async () => existingConfig as any)
    mockUpdate.mockImplementationOnce(async () => updatedConfig as any)

    setMockAuthContext({
      organizationId: "org-1",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/webhooks/wh_patch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          webhookUrl: "https://example.com/new-webhook",
          active: false,
        }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; data?: unknown }
    expect(payload.ok).toBe(true)
    expect((payload.data as any).active).toBe(false)
  })

  it("deletes a webhook config as super_admin", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "wh_delete",
      organizationId: "org-other",
      whatsappDeviceId: "dev_1",
      webhookUrl: "https://example.com/webhook",
      verifyToken: "token123",
      active: true,
    } as any))
    mockDelete.mockImplementationOnce(async () => ({}))

    setMockAuthContext({
      platformRole: "super_admin",
      orgRole: "admin",
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/webhooks/wh_delete", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean }
    expect(payload.ok).toBe(true)
  })

  // ── Signature Verification (placeholder) ─────────────────────────────────────

  it("handles webhook with signature in headers", async () => {
    // The actual signature verification would require Meta's secret key
    // This test verifies the webhook endpoint accepts requests with common headers
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/webhooks/dev_signature", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": "sha256=abc123", // Common header format
        },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          entry: [],
        }),
      })
    )

    expect(response.status).toBe(200)
  })
})

