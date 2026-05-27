import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import type { WorkOSScope } from "@/lib/whatsapp/auth"

// ─── Mock auth context factory ─────────────────────────────────────────────────

function createMockAuthContext(
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

  return {
    ...base,
    ...overrides,
  } as WorkOSScope
}

// ─── Mock guards ────────────────────────────────────────────────────────────────

function createMockGuards(authContext: WorkOSScope | null) {
  return {
    guardSuperAdmin: (route: (...args: unknown[]) => unknown) =>
      async (ctx: { whatsappAuth?: WorkOSScope | null; set: { status: number } }) => {
        if (!ctx.whatsappAuth) {
          ctx.set.status = 401
          return { ok: false, error: "UNAUTHORIZED", message: "Not authenticated." }
        }
        if (ctx.whatsappAuth.platformRole !== "super_admin") {
          ctx.set.status = 403
          return { ok: false, error: "FORBIDDEN", message: "super_admin required." }
        }
        return route(ctx)
      },
    guardTenantAdmin: (route: (...args: unknown[]) => unknown) =>
      async (ctx: { whatsappAuth?: WorkOSScope | null; set: { status: number } }) => {
        if (!ctx.whatsappAuth) {
          ctx.set.status = 401
          return { ok: false, error: "UNAUTHORIZED", message: "Not authenticated." }
        }
        const auth = ctx.whatsappAuth
        const isAdmin =
          auth.tenantRole === "admin" ||
          auth.tenantRole === "owner" ||
          auth.platformRole === "super_admin"
        if (!isAdmin) {
          ctx.set.status = 403
          return { ok: false, error: "FORBIDDEN", message: "tenant admin required." }
        }
        return route(ctx)
      },
    whatsappAuthPlugin: new Elysia({ name: "whatsapp.auth" }).derive(() => ({
      whatsappAuth: authContext,
    })),
  }
}

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

// ─── WorkOS mock ─────────────────────────────────────────────────────────────────
// @workos-inc/node v9.3.0 removed getWorkOS; stub to avoid SyntaxError at module eval
mock.module("@workos-inc/node", () => ({
  getWorkOS: () => null,
  WorkOSNode: class MockWorkOS {},
}))

// ─── Module-level auth mock (before route import) ──────────────────────────────

// Default mock - can be replaced per test
let currentAuthContext: WorkOSScope | null = createMockAuthContext()

mock.module("@/lib/whatsapp/auth", () => createMockGuards(currentAuthContext))

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

// ─── Route under test ─────────────────────────────────────────────────────────────

import { devicesRoutes } from "./devices.route"

// ─── App factory ────────────────────────────────────────────────────────────────

function createTestApp(authContext: WorkOSScope | null) {
  currentAuthContext = authContext
  return new Elysia()
    .derive(() => ({ whatsappAuth: authContext }))
    .use(devicesRoutes)
}

// ─── Tests ─────────────────────────────────────────────────────────────────────────

describe("devices routes", () => {
  // Reset mock implementations before each test
  beforeEach(() => {
    mockFindUnique.mockImplementation(async () => null)
    mockFindMany.mockImplementation(async () => [])
  })

  // ── Auth guard (401 from whatsappAuthPlugin) ────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    const app = createTestApp(null)

    const response = await app.handle(
      new Request("http://localhost/devices")
    )

    expect(response.status).toBe(401)
    const payload = await response.json()
    expect(payload.error).toBe("UNAUTHORIZED")
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
      },
    ])

    const authContext = createMockAuthContext({ tenantRole: "admin" })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices")
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; devices: unknown[] }
    expect(payload.ok).toBe(true)
    expect(payload.devices).toHaveLength(1)
  })

  it("returns empty list when no devices", async () => {
    const authContext = createMockAuthContext({ tenantRole: "admin" })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices")
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; devices: unknown[] }
    expect(payload.devices).toHaveLength(0)
  })

  // ── Get one ────────────────────────────────────────────────────────────────────

  it("returns 404 when device not found", async () => {
    const authContext = createMockAuthContext({ tenantRole: "admin" })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing")
    )

    expect(response.status).toBe(404)
    const payload = await response.json() as { ok: boolean; error: string }
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

    const authContext = createMockAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other")
    )

    expect(response.status).toBe(403)
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Create ────────────────────────────────────────────────────────────────────

  it("returns 403 when non-super_admin tries to create", async () => {
    const authContext = createMockAuthContext({
      platformRole: "none",
      tenantRole: "admin",
    })
    const app = createTestApp(authContext)

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
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  it("returns 422 for missing name on create", async () => {
    const authContext = createMockAuthContext({
      platformRole: "super_admin",
      organizationId: "org_admin",
    })
    const app = createTestApp(authContext)

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
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("VALIDATION_ERROR")
  })

  it("returns 422 for missing phoneNumber on create", async () => {
    const authContext = createMockAuthContext({
      platformRole: "super_admin",
      organizationId: "org_admin",
    })
    const app = createTestApp(authContext)

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
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("VALIDATION_ERROR")
  })

  it("creates device as super_admin", async () => {
    mockCreate.mockImplementationOnce(async () => ({
      id: "dev_new",
      organizationId: "org_admin",
      name: "Admin Device",
      phoneNumber: "+628****1111",
      status: "DISCONNECTED",
    } as any))

    const authContext = createMockAuthContext({
      platformRole: "super_admin",
      organizationId: "org_admin",
    })
    const app = createTestApp(authContext)

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
    const payload = await response.json() as { ok: boolean; device?: unknown }
    expect(payload.ok).toBe(true)
  })

  // ── Update ────────────────────────────────────────────────────────────────────

  it("returns 404 when updating missing device", async () => {
    const authContext = createMockAuthContext({
      platformRole: "super_admin",
      tenantRole: "admin",
    })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated" }),
      })
    )

    expect(response.status).toBe(404)
    const payload = await response.json() as { ok: boolean; error: string }
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

    const authContext = createMockAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Hacked" }),
      })
    )

    expect(response.status).toBe(403)
    const payload = await response.json() as { ok: boolean; error: string }
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

    const authContext = createMockAuthContext({
      platformRole: "super_admin",
      tenantRole: "admin",
    })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated Name" }),
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; device?: unknown }
    expect(payload.ok).toBe(true)
  })

  // ── Delete ────────────────────────────────────────────────────────────────────

  it("deletes device as super_admin", async () => {
    const authContext = createMockAuthContext({
      platformRole: "super_admin",
    })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; message: string }
    expect(payload.ok).toBe(true)
    expect(payload.message).toBe("Device deleted.")
  })

  it("returns 403 when non-super_admin tries delete", async () => {
    const authContext = createMockAuthContext({
      platformRole: "none",
      tenantRole: "admin",
    })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(403)
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Verify ────────────────────────────────────────────────────────────────────

  it("returns 404 when verifying missing device", async () => {
    const authContext = createMockAuthContext({ tenantRole: "admin" })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing/verify", {
        method: "POST",
      })
    )

    expect(response.status).toBe(404)
    const payload = await response.json() as { ok: boolean; error: string }
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

    const authContext = createMockAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other/verify", {
        method: "POST",
      })
    )

    expect(response.status).toBe(403)
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Reconnect ─────────────────────────────────────────────────────────────────

  it("returns 404 when reconnecting missing device", async () => {
    const authContext = createMockAuthContext({ tenantRole: "admin" })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_missing/reconnect", {
        method: "POST",
      })
    )

    expect(response.status).toBe(404)
    const payload = await response.json() as { ok: boolean; error: string }
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

    const authContext = createMockAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    })
    const app = createTestApp(authContext)

    const response = await app.handle(
      new Request("http://localhost/devices/dev_other/reconnect", {
        method: "POST",
      })
    )

    expect(response.status).toBe(403)
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })
})
