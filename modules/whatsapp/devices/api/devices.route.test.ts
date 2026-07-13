import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import {
  setMockAuthContext,
  mockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"
import {
  decryptWhatsAppToken,
  encryptWhatsAppToken,
} from "@/lib/whatsapp/crypto"
import { workosNodeMock } from "../../../../test/workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

const mockFindUnique = mock(async (): Promise<any> => null)
const mockFindMany = mock(async (): Promise<any[]> => [])
const mockUpdate = mock(async (): Promise<any> => createMockDevice())
const mockEnqueueWhatsAppTemplateSync = mock(async () => {})
const originalAppKey = process.env.APP_KEY
const TEST_APP_KEY = Buffer.alloc(32, 5).toString("base64")
const mockWithAuth = mock(async () => ({
  user: { id: "user_1", email: "admin@example.com" },
  organizationId: "org_1",
  role: "admin",
  roles: ["admin"],
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}))

mock.module("@/lib/queue/whatsapp-template-sync", () => ({
  enqueueWhatsAppTemplateSync: mockEnqueueWhatsAppTemplateSync,
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mock(async () => "none"),
}))

// ─── Auth mock ─────────────────────────────────────────────────────────────────

mock.module("@workos-inc/node", () => workosNodeMock)

mock.module("@/lib/auth/resolve-proxy-auth", () => ({
  resolveAuthContext: async () => mockAuthContext.current,
}))

const { devicesRoutes } = await import("./devices.route")

function createTestApp() {
  return new Elysia().use(devicesRoutes)
}

function createMockDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: "dev_1",
    organizationId: "org_1",
    phoneNumber: "+62811111111",
    balance: 0,
    quotaBase: 1000,
    quotaBaseOut: 0,
    dailyLimitMessage: 500,
    status: "ACTIVE",
    token: null,
    tokenEncrypted: null,
    tokenIv: null,
    whatsappBusinessAccountId: null,
    whatsappPhoneId: null,
    whatsappApplicationId: null,
    whatsappProfile: null,
    features: null,
    callbackUrl: null,
    expiredAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

function getUpdatedTokenEncrypted() {
  const calls = mockUpdate.mock.calls as unknown as Array<
    [{ data?: { tokenEncrypted?: unknown } }]
  >
  const updateArg = calls[0]?.[0]

  if (typeof updateArg?.data?.tokenEncrypted !== "string") {
    throw new Error("Expected tokenEncrypted update payload")
  }

  return updateArg.data.tokenEncrypted
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("devices routes", () => {
  beforeEach(() => {
    process.env.APP_KEY = TEST_APP_KEY
    mockFindUnique.mockClear()
    mockFindMany.mockClear()
    mockUpdate.mockClear()
    mockEnqueueWhatsAppTemplateSync.mockClear()
    mockWithAuth.mockClear()
    mockFindUnique.mockImplementation(async () => null)
    mockFindMany.mockImplementation(async () => [])
    mockUpdate.mockImplementation(async () => createMockDevice())
    mockEnqueueWhatsAppTemplateSync.mockImplementation(async () => {})
    mockWithAuth.mockImplementation(async () => ({
      user: { id: "user_1", email: "admin@example.com" },
      organizationId: "org_1",
      role: "admin",
      roles: ["admin"],
    }))
    setMockAuthContext({
      type: "workos",
      userId: "user_1",
      email: "admin@example.com",
      organizationId: "org_1",
      orgRole: "admin",
      platformRole: "none",
    })
  })

  afterEach(() => {
    if (originalAppKey === undefined) {
      delete process.env.APP_KEY
    } else {
      process.env.APP_KEY = originalAppKey
    }
  })

  // ── List ────────────────────────────────────────────────────────────────────

  it("returns device list", async () => {
    mockFindMany.mockImplementationOnce(async () => [
      createMockDevice({ id: "dev_1", phoneNumber: "+62811111111" }),
    ])

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/devices"))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      ok: boolean
      devices: Array<{ id: string }>
    }
    expect(payload.ok).toBe(true)
    expect(payload.devices).toHaveLength(1)
    expect(payload.devices[0].id).toBe("dev_1")
  })

  it("uses whatsappProfile.name as device name when present", async () => {
    mockFindMany.mockImplementationOnce(async () => [
      createMockDevice({
        id: "dev_named",
        phoneNumber: "+62811111111",
        whatsappProfile: { name: "Support Line" },
      }),
    ])

    const app = createTestApp()
    const response = await app.handle(new Request("http://localhost/devices"))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      ok: boolean
      devices: Array<{ name: string; phoneNumber: string }>
    }
    expect(payload.ok).toBe(true)
    expect(payload.devices[0].name).toBe("Support Line")
    expect(payload.devices[0].phoneNumber).toBe("+62811111111")
  })

  it("returns empty list when no devices", async () => {
    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/devices"))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      ok: boolean
      devices: unknown[]
    }
    expect(payload.devices).toHaveLength(0)
  })

  // ── Get one ─────────────────────────────────────────────────────────────────

  it("returns 404 when device not found", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing")
    )

    expect(response.status).toBe(404)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("NOT_FOUND")
  })

  it("returns 403 for device from other org", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({ id: "dev_other", organizationId: "org_other" })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other")
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  it("returns device details for own org", async () => {
    mockFindUnique.mockImplementationOnce(async () => createMockDevice())

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1")
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      ok: boolean
      device: { id: string; name: string }
    }
    expect(payload.ok).toBe(true)
    expect(payload.device.id).toBe("dev_1")
    expect(payload.device.name).toBe("+62811111111")
  })

  // ── Create disabled ─────────────────────────────────────────────────────────

  it("does not allow regular device creation", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "New Device",
          phoneNumber: "+62822222222",
          environment: "LIVE",
        }),
      })
    )

    expect(response.status).toBe(405)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("METHOD_NOT_ALLOWED")
  })

  it("does not allow updating device fields from the console API", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: "+62833333333" }),
      })
    )

    expect(response.status).toBe(405)
    const payload = (await response.json()) as { ok: boolean; error: string; message: string }
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("METHOD_NOT_ALLOWED")
    expect(payload.message).toBe("WhatsApp device system fields cannot be updated from the console API. Update the WhatsApp profile instead.")
    // Ensure the prisma update was never called
    expect(mockUpdate.mock.calls.length).toBe(0)
  })

  // ── Delete disabled ─────────────────────────────────────────────────────────

  it("does not allow deleting devices from the console API", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(405)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("METHOD_NOT_ALLOWED")
  })

  // ── Verify ─────────────────────────────────────────────────────────────────

  it("returns 404 when verifying missing device", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing/verify", {
        method: "POST",
      })
    )

    expect(response.status).toBe(404)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("NOT_FOUND")
  })

  it("returns 403 when verifying device from other org", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({ id: "dev_other", organizationId: "org_other" })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other/verify", {
        method: "POST",
      })
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Reconnect ──────────────────────────────────────────────────────────────

  it("returns 404 when reconnecting missing device", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing/reconnect", {
        method: "POST",
      })
    )

    expect(response.status).toBe(404)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("NOT_FOUND")
  })

  it("returns 403 when reconnecting device from other org", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({ id: "dev_other", organizationId: "org_other" })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other/reconnect", {
        method: "POST",
      })
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Template sync ──────────────────────────────────────────────────────────

  it("returns 404 when syncing templates for missing device", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing/sync-templates", {
        method: "POST",
      })
    )

    expect(response.status).toBe(404)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("NOT_FOUND")
    expect(mockEnqueueWhatsAppTemplateSync).not.toHaveBeenCalled()
  })

  it("returns 403 when syncing templates for device from other org", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({
        id: "dev_other",
        organizationId: "org_other",
        tokenEncrypted: "encrypted-token",
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
      })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other/sync-templates", {
        method: "POST",
      })
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
    expect(mockEnqueueWhatsAppTemplateSync).not.toHaveBeenCalled()
  })

  it("returns 400 when syncing templates without a device token", async () => {
    mockFindUnique.mockImplementationOnce(async () => createMockDevice())

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1/sync-templates", {
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("BAD_REQUEST")
    expect(mockEnqueueWhatsAppTemplateSync).not.toHaveBeenCalled()
  })

  it("returns 400 when syncing templates without Meta account ids", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({ tokenEncrypted: await encryptWhatsAppToken("token") })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1/sync-templates", {
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }
    expect(payload.error).toBe("BAD_REQUEST")
    expect(payload.message).toContain("WhatsApp Business Account ID")
    expect(mockEnqueueWhatsAppTemplateSync).not.toHaveBeenCalled()
  })

  it("encrypts legacy raw token before enqueuing template sync", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({
        token: "legacy-token",
        tokenEncrypted: null,
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
      })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1/sync-templates", {
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "dev_1" },
      data: {
        token: null,
        tokenEncrypted: expect.any(String),
        tokenIv: null,
      },
    })

    const encryptedToken = getUpdatedTokenEncrypted()
    await expect(decryptWhatsAppToken(encryptedToken)).resolves.toBe(
      "legacy-token"
    )
    expect(mockEnqueueWhatsAppTemplateSync).toHaveBeenCalledWith(
      "org_1",
      "dev_1",
      "sync-templates"
    )
  })

  it("repairs invalid encrypted token from legacy raw token", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({
        token: "replacement-token",
        tokenEncrypted: "v1.bad.bad",
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
      })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1/sync-templates", {
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    const encryptedToken = getUpdatedTokenEncrypted()
    await expect(decryptWhatsAppToken(encryptedToken)).resolves.toBe(
      "replacement-token"
    )
    expect(mockEnqueueWhatsAppTemplateSync).toHaveBeenCalledWith(
      "org_1",
      "dev_1",
      "sync-templates"
    )
  })

  it("returns 400 when encrypted token is invalid and no raw token remains", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({
        token: null,
        tokenEncrypted: "v1.bad.bad",
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
      })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1/sync-templates", {
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("BAD_REQUEST")
    expect(payload.message).toContain("cannot be decrypted")
    expect(mockEnqueueWhatsAppTemplateSync).not.toHaveBeenCalled()
  })

  it("enqueues Meta template sync for own org device", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({
        tokenEncrypted: await encryptWhatsAppToken("token"),
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
      })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1/sync-templates", {
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      ok: boolean
      message: string
    }
    expect(payload.ok).toBe(true)
    expect(payload.message).toBe("Sync job enqueued.")
    expect(mockEnqueueWhatsAppTemplateSync).toHaveBeenCalledWith(
      "org_1",
      "dev_1",
      "sync-templates"
    )
  })

  it("returns 503 when template sync queue enqueue fails", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({
        tokenEncrypted: await encryptWhatsAppToken("token"),
        whatsappBusinessAccountId: "waba-1",
        whatsappPhoneId: "phone-1",
      })
    )
    mockEnqueueWhatsAppTemplateSync.mockImplementationOnce(async () => {
      throw new Error("WRONGPASS invalid username-password pair")
    })

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1/sync-templates", {
        method: "POST",
      })
    )

    expect(response.status).toBe(503)
    const payload = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }
    expect(payload.ok).toBe(false)
    expect(payload.error).toBe("QUEUE_UNAVAILABLE")
    expect(payload.message).toContain("REDIS_URL")
  })
})
