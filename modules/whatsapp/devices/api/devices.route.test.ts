import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import {
  setMockAuthContext,
  mockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "../../../../test/workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

const mockFindUnique = mock(async (): Promise<any> => null)
const mockFindMany = mock(async (): Promise<any[]> => [])
const mockUpdate = mock(async (): Promise<any> => createMockDevice())

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
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
    quotaBaseIn: 0,
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("devices routes", () => {
  beforeEach(() => {
    mockFindUnique.mockClear()
    mockFindMany.mockClear()
    mockUpdate.mockClear()
    mockFindUnique.mockImplementation(async () => null)
    mockFindMany.mockImplementation(async () => [])
    mockUpdate.mockImplementation(async () => createMockDevice())
    setMockAuthContext({
      type: "workos",
      userId: "user_1",
      email: "admin@example.com",
      organizationId: "org_1",
      orgRole: "admin",
      platformRole: "none",
    })
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

  // ── Update ─────────────────────────────────────────────────────────────────

  it("returns 404 when updating missing device", async () => {
    setMockAuthContext({ platformRole: "super_admin" })
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: "+62833333333" }),
      })
    )

    expect(response.status).toBe(404)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("NOT_FOUND")
  })

  it("returns 403 when updating device from other org", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({ id: "dev_other", organizationId: "org_other" })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: "+62833333333" }),
      })
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  it("updates device with PATCH and ignores non-persisted fields", async () => {
    mockFindUnique.mockImplementationOnce(async () => createMockDevice())
    mockUpdate.mockImplementationOnce(async () =>
      createMockDevice({
        phoneNumber: "+62833333333",
        quotaBase: 2000,
        dailyLimitMessage: 750,
      })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
          environment: "SANDBOX",
          phoneNumber: "+62833333333",
          quotaBase: 2000,
          dailyLimitMessage: 750,
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "dev_1" },
      data: {
        phoneNumber: "+62833333333",
        quotaBase: 2000,
        dailyLimitMessage: 750,
      },
    })
    const payload = (await response.json()) as { ok: boolean; device?: unknown }
    expect(payload.ok).toBe(true)
  })

  it("returns 422 for invalid PATCH body", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: "" }),
      })
    )

    expect(response.status).toBe(422)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("VALIDATION_ERROR")
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
})
