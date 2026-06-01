import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import {
  whatsappAuthMock,
  setMockAuthContext,
} from "@/lib/whatsapp/__tests__/auth-mock"
import { workosNodeMock } from "../../../../test/workos-node-mock"

// ─── Prisma mock ────────────────────────────────────────────────────────────────

const mockFindUnique = mock(async () => null)
const mockFindMany = mock(async () => [])
const mockDelete = mock(async () => ({}))
const mockCreate = mock(async () => ({
  id: "dev_mock",
  organizationId: "org_1",
  name: "Mock Device",
  phoneNumber: "+628****1111",
  status: "DISCONNECTED",
}))
const mockUpdate = mock(async () => ({
  id: "dev_mock",
  organizationId: "org_1",
  name: "Mock Device",
  phoneNumber: "+628****1111",
  status: "ACTIVE",
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    whatsappDevice: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

// ─── Auth mock ─────────────────────────────────────────────────────────────────

mock.module("@/lib/whatsapp/auth", () => whatsappAuthMock)

mock.module("@workos-inc/node", () => workosNodeMock)

const { devicesRoutes } = await import("./devices.route")

function createTestApp() {
  return new Elysia().use(devicesRoutes)
}

// ─── Tests ─────────────────────────────────────────────────────────────────────────

describe("devices routes", () => {
  beforeEach(() => {
    mockFindUnique.mockImplementation(async () => null)
    mockFindMany.mockImplementation(async () => [])
    setMockAuthContext({
      type: "workos",
      userId: "user_1",
      email: "admin@example.com",
      organizationId: "org_1",
      orgRole: "admin",
      platformRole: "none",
    })
  })

  // ── List ────────────────────────────────────────────────────────────────────────

  it("returns device list", async () => {
    mockFindMany.mockImplementationOnce(async () => [
      {
        id: "dev_1",
        organizationId: "org_1",
        phoneNumber: "+628****1111",
        name: "Device 1",
        status: "ACTIVE",
      } as any,
    ] as any)

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/devices"))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { ok: boolean; devices: unknown[] }
    expect(payload.ok).toBe(true)
    expect(payload.devices).toHaveLength(1)
  })

  it("returns empty list when no devices", async () => {
    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/devices"))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { ok: boolean; devices: unknown[] }
    expect(payload.devices).toHaveLength(0)
  })

  // ── Get one ────────────────────────────────────────────────────────────────────

  it("returns 404 when device not found", async () => {
    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/devices/dev_missing"))

    expect(response.status).toBe(404)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("NOT_FOUND")
  })

  it("returns 403 when device belongs to other org", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "dev_other",
      organizationId: "org_other",
      phoneNumber: "+628****1111",
      name: "Other Device",
      status: "ACTIVE",
    } as any))

    const app = createTestApp()

    const response = await app.handle(new Request("http://localhost/devices/dev_other"))

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Create ────────────────────────────────────────────────────────────────────

  it("returns 403 when non-admin tries to create", async () => {
    setMockAuthContext({
      type: "workos",
      userId: "user_1",
      email: "member@example.com",
      organizationId: "org_1",
      orgRole: "member",
      platformRole: "none",
    })
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "New Device",
          phoneNumber: "+628****1111",
          businessId: "bid_1",
          accessToken: "token_1",
          environment: "LIVE",
        }),
      })
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  it("returns 422 for missing name on create", async () => {
    setMockAuthContext({ platformRole: "super_admin", organizationId: "org_admin" })
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumber: "+628****1111",
          businessId: "bid_1",
          accessToken: "token_1",
        }),
      })
    )

    expect(response.status).toBe(422)
    const payload = (await response.json()) as { type?: string }
    expect(payload.type).toBeDefined()
  })

  it("returns 422 for missing phoneNumber on create", async () => {
    setMockAuthContext({ platformRole: "super_admin", organizationId: "org_admin" })
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "New Device",
          businessId: "bid_1",
          accessToken: "token_1",
        }),
      })
    )

    expect(response.status).toBe(422)
    const payload = (await response.json()) as { type?: string }
    expect(payload.type).toBeDefined()
  })

  it("creates device as super_admin", async () => {
    mockCreate.mockImplementationOnce(async () => ({
      id: "dev_new",
      organizationId: "org_admin",
      name: "Admin Device",
      phoneNumber: "+628****1111",
      status: "DISCONNECTED",
    } as any))

    setMockAuthContext({ platformRole: "super_admin", organizationId: "org_admin" })
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Admin Device",
          phoneNumber: "+628****1111",
          businessId: "bid_1",
          accessToken: "token_1",
          environment: "LIVE",
        }),
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { ok: boolean; device?: unknown }
    expect(payload.ok).toBe(true)
  })

  // ── Update ────────────────────────────────────────────────────────────────────

  it("returns 404 when updating missing device", async () => {
    setMockAuthContext({ platformRole: "super_admin" })
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      })
    )

    expect(response.status).toBe(404)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("NOT_FOUND")
  })

  it("returns 403 when updating device of other org", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "dev_other",
      organizationId: "org_other",
      phoneNumber: "+628****1111",
      name: "Other Device",
      status: "ACTIVE",
    } as any))

    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Hacked" }),
      })
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  it("updates device", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "dev_1",
      organizationId: "org_1",
      phoneNumber: "+628****1111",
      name: "Old Name",
      status: "ACTIVE",
    } as any))

    mockUpdate.mockImplementationOnce(async () => ({
      id: "dev_1",
      organizationId: "org_1",
      phoneNumber: "+628****1111",
      name: "Updated Name",
      status: "ACTIVE",
    } as any))

    setMockAuthContext({ platformRole: "super_admin" })
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { ok: boolean; device?: unknown }
    expect(payload.ok).toBe(true)
  })

  // ── Delete ────────────────────────────────────────────────────────────────────

  it("deletes device as super_admin", async () => {
    setMockAuthContext({ platformRole: "super_admin" })
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { ok: boolean; message: string }
    expect(payload.ok).toBe(true)
    expect(payload.message).toBe("Device deleted.")
  })

  it("returns 403 when non-super_admin tries delete", async () => {
    const app = createTestApp()

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Verify ────────────────────────────────────────────────────────────────────

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

  it("returns 403 when verifying device of other org", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "dev_other",
      organizationId: "org_other",
      phoneNumber: "+628****1111",
      name: "Other Device",
      status: "ACTIVE",
    } as any))

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

  // ── Reconnect ─────────────────────────────────────────────────────────────────

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

  it("returns 403 when reconnecting device of other org", async () => {
    mockFindUnique.mockImplementationOnce(async () => ({
      id: "dev_other",
      organizationId: "org_other",
      phoneNumber: "+628****1111",
      name: "Other Device",
      status: "ACTIVE",
    } as any))

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
