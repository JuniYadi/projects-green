import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import {
  setMockAuthContext,
  mockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "./workos-node-mock"

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

const { devicesRoutes } =
  await import("@/modules/whatsapp/devices/api/devices.route")

function createTestApp() {
  return new Elysia().use(devicesRoutes)
}

function createMockDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: "dev_1",
    organizationId: "org-1",
    phoneNumber: "+6281111111111",
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("WhatsApp Devices E2E", () => {
  beforeEach(() => {
    mockFindUnique.mockClear()
    mockFindMany.mockClear()
    mockUpdate.mockClear()
    mockFindUnique.mockImplementation(async () => null)
    mockFindMany.mockImplementation(async () => [])
    mockUpdate.mockImplementation(async () => createMockDevice())

    setMockAuthContext({
      type: "workos",
      userId: "user-1",
      email: "admin@example.com",
      organizationId: "org-1",
      orgRole: "admin",
      platformRole: "none",
    })
  })

  // ── Create Device Disabled ──────────────────────────────────────────────────

  it("rejects regular device creation", async () => {
    const app = createTestApp()

    const createResponse = await app.handle(
      new Request("http://localhost/devices/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Test Device",
          phoneNumber: "+6281111111111",
          environment: "LIVE",
        }),
      })
    )

    expect(createResponse.status).toBe(405)
    const createPayload = (await createResponse.json()) as {
      ok: boolean
      error: string
    }
    expect(createPayload.ok).toBe(false)
    expect(createPayload.error).toBe("METHOD_NOT_ALLOWED")
  })

  // ── GET Device ──────────────────────────────────────────────────────────────

  it("returns device data for valid ID", async () => {
    const deviceData = createMockDevice({
      id: "dev_get",
      phoneNumber: "+6282222222222",
    })

    mockFindUnique.mockImplementationOnce(async () => deviceData)

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_get")
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as { ok: boolean; device?: any }
    expect(payload.ok).toBe(true)
    expect(payload.device.id).toBe("dev_get")
    expect(payload.device.phoneNumber).toBe("+6282222222222")
  })

  it("returns 404 for non-existent device", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing")
    )
    expect(response.status).toBe(404)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("NOT_FOUND")
  })

  // ── PATCH Device ────────────────────────────────────────────────────────────

  it("updates device and verifies the change", async () => {
    const originalDevice = createMockDevice({
      id: "dev_patch",
      phoneNumber: "+6283333333333",
    })

    const updatedDevice = {
      ...originalDevice,
      phoneNumber: "+6289999999999",
      quotaBase: 2000,
    }

    mockFindUnique.mockImplementationOnce(async () => originalDevice)
    mockUpdate.mockImplementationOnce(async () => updatedDevice)

    const app = createTestApp()

    const patchResponse = await app.handle(
      new Request("http://localhost/devices/dev_patch", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumber: "+6289999999999",
          quotaBase: 2000,
        }),
      })
    )

    expect(patchResponse.status).toBe(200)
    const patchPayload = (await patchResponse.json()) as {
      ok: boolean
      device?: any
    }
    expect(patchPayload.ok).toBe(true)
    expect(patchPayload.device.phoneNumber).toBe("+6289999999999")
    expect(patchPayload.device.quotaBase).toBe(2000)

    mockFindUnique.mockImplementationOnce(async () => updatedDevice)

    const getResponse = await app.handle(
      new Request("http://localhost/devices/dev_patch")
    )
    expect(getResponse.status).toBe(200)
    const getPayload = (await getResponse.json()) as {
      ok: boolean
      device?: any
    }
    expect(getPayload.device.phoneNumber).toBe("+6289999999999")
  })

  // ── DELETE Device Disabled ──────────────────────────────────────────────────

  it("rejects deleting a device", async () => {
    const app = createTestApp()

    const deleteResponse = await app.handle(
      new Request("http://localhost/devices/dev_del", {
        method: "DELETE",
      })
    )

    expect(deleteResponse.status).toBe(405)
    const deletePayload = (await deleteResponse.json()) as {
      ok: boolean
      error: string
    }
    expect(deletePayload.ok).toBe(false)
    expect(deletePayload.error).toBe("METHOD_NOT_ALLOWED")
  })

  // ── Authorization ──────────────────────────────────────────────────────────

  it("returns 403 when updating device from different organization", async () => {
    mockFindUnique.mockImplementationOnce(async () =>
      createMockDevice({
        id: "dev_other_org",
        organizationId: "org-other",
        phoneNumber: "+6286666666666",
      })
    )

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other_org", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumber: "+6287777777777" }),
      })
    )

    expect(response.status).toBe(403)
  })
})
