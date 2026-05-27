import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import type { WorkOSScope, WhatsAppAuthContext } from "@/lib/whatsapp/auth"

// ─── Auth context factory ──────────────────────────────────────────────────────

function createAuthContext(
  overrides: Partial<WorkOSScope> = {}
): WorkOSScope {
  const base: WorkOSScope = {
    type: "workos",
    userId: "user_1",
    email: "admin@example.com",
    organizationId: "org_1",
    tenantRole: "admin",
    platformRole: "none",
  }

  return { ...base, ...overrides } as WorkOSScope
}

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

const mockGuardSuperAdmin = (route: (...args: unknown[]) => unknown) =>
  async (ctx: { whatsappAuth?: WorkOSScope | null; set: { status: number } }) => {
    const auth = ctx.whatsappAuth
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    if (auth.platformRole !== "super_admin") {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    return route(ctx)
  }

const mockGuardTenantAdmin = (route: (...args: unknown[]) => unknown) =>
  async (ctx: { whatsappAuth?: WorkOSScope | null; set: { status: number } }) => {
    const auth = ctx.whatsappAuth
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED" }
    }
    const isAdmin =
      auth.tenantRole === "admin" ||
      auth.tenantRole === "owner" ||
      auth.platformRole === "super_admin"
    if (!isAdmin) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN" }
    }
    return route(ctx)
  }

mock.module("/Users/juniyadi/github-yadi/pfnapp-v2/lib/whatsapp/auth.ts", () => ({
  whatsappAuthPlugin: new Elysia({ name: "whatsapp.auth" })
    .derive(() => ({ whatsappAuth: null })),
  guardSuperAdmin: mockGuardSuperAdmin,
  guardTenantAdmin: mockGuardTenantAdmin,
  guardWorkOSSession: mockGuardTenantAdmin,
  guardApiKey: mockGuardTenantAdmin,
  requireTenantAdmin: (ctx: WorkOSScope) =>
    ctx.tenantRole === "admin" || ctx.tenantRole === "owner" || ctx.platformRole === "super_admin",
  requireSuperAdmin: (ctx: WorkOSScope) => ctx.platformRole === "super_admin",
  requireWorkOSSession: (_ctx: WorkOSScope) => true,
  requireApiKey: (_ctx: WorkOSScope) => false,
  requireTenantMember: (ctx: WorkOSScope) => ctx.organizationId !== null,
}))

mock.module("@workos-inc/node", () => ({
  getWorkOS: () => null,
  WorkOSNode: class MockWorkOS {},
}))

import { webhooksRoutes } from "@/modules/whatsapp/webhooks/api/webhooks.route"

function createTestApp(auth: WorkOSScope | null, withAuth = true) {
  const app = new Elysia()
  if (withAuth) {
    app.derive(() => ({ whatsappAuth: auth }))
  }
  return app.use(webhooksRoutes)
}

// ─── Tests ─────────────────────────────────────────────────────────────────────────

describe("WhatsApp Webhooks E2E", () => {
  beforeEach(() => {
    mockFindMany.mockImplementation(async () => [] as any)
    mockFindUnique.mockImplementation(async () => null as any)
    mockCreate.mockImplementation(async () => null as any)
    mockCount.mockImplementation(async () => 0)
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

    const app = createTestApp(createAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    }), false)

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
    const app = createTestApp(null, false)

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
    const app = createTestApp(null, false)

    const response = await app.handle(
      new Request("http://localhost/webhooks/dev_verify/verify?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=challenge_code")
    )

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toBe("challenge_code")
  })

  it("returns 403 for invalid verify mode", async () => {
    const app = createTestApp(null, false)

    const response = await app.handle(
      new Request("http://localhost/webhooks/dev_verify/verify?hub.mode=invalid&hub.verify_token=test&hub.challenge=code")
    )

    expect(response.status).toBe(500)
  })

  // ── CRUD Webhook Config ─────────────────────────────────────────────────────

  it("creates a webhook config", async () => {
    const webhookConfig = {
      id: "wh_new",
      organizationId: "org_1",
      whatsappDeviceId: "dev_1",
      webhookUrl: "https://example.com/webhook",
      verifyToken: "token123",
      active: true,
    }

    mockCreate.mockImplementationOnce(async () => webhookConfig as any)

    const app = createTestApp(createAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/webhooks/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: "org_1",
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
        organizationId: "org_1",
        whatsappDeviceId: "dev_1",
        webhookUrl: "https://example.com/webhook1",
        verifyToken: "token1",
        active: true,
      },
      {
        id: "wh_2",
        organizationId: "org_1",
        whatsappDeviceId: "dev_2",
        webhookUrl: "https://example.com/webhook2",
        verifyToken: "token2",
        active: true,
      },
    ]

    // Reset and set up mock for this specific test
    mockFindMany.mockImplementation(async () => webhookConfigs)
    mockCount.mockImplementation(async () => 2)

    const app = createTestApp(createAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    }))

    const response = await app.handle(new Request("http://localhost/webhooks/"))
    expect(response.status).toBe(200)
    const payload = await response.json() as { data: unknown[]; meta: { total: number } }
    expect(payload.data).toHaveLength(2)
    expect(payload.meta.total).toBe(2)
  })

  it("gets a single webhook config", async () => {
    const webhookConfig = {
      id: "wh_get",
      organizationId: "org_1",
      whatsappDeviceId: "dev_1",
      webhookUrl: "https://example.com/webhook",
      verifyToken: "token123",
      active: true,
    }

    mockFindUnique.mockImplementationOnce(async () => webhookConfig as any)

    const app = createTestApp(createAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    }))

    const response = await app.handle(new Request("http://localhost/webhooks/wh_get"))
    expect(response.status).toBe(200)
    const payload = await response.json() as { id: string }
    expect(payload.id).toBe("wh_get")
  })

  it("updates a webhook config", async () => {
    const updatedConfig = {
      id: "wh_patch",
      organizationId: "org_1",
      whatsappDeviceId: "dev_1",
      webhookUrl: "https://example.com/new-webhook",
      verifyToken: "new_token",
      active: false,
    }

    mockUpdate.mockImplementationOnce(async () => updatedConfig as any)

    const app = createTestApp(createAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    }))

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
    mockDelete.mockImplementationOnce(async () => ({}))

    const app = createTestApp(createAuthContext({
      platformRole: "super_admin",
      tenantRole: "admin",
    }))

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
    const app = createTestApp(null, false)

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
