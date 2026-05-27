import { beforeEach, describe, expect, it, mock } from "bun:test"
import { Elysia } from "elysia"

import type { WorkOSScope } from "@/lib/whatsapp/auth"

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
  requireWorkOSSession: (ctx: WorkOSScope) => ctx.type === "workos",
  requireApiKey: (ctx: WorkOSScope) => ctx.type === "platform",
  requireTenantMember: (ctx: WorkOSScope) => ctx.organizationId !== null,
}))

mock.module("@workos-inc/node", () => ({
  getWorkOS: () => null,
  WorkOSNode: class MockWorkOS {},
}))

import { devicesRoutes } from "./devices.route"

function createTestApp(auth: WorkOSScope | null) {
  return new Elysia()
    .derive(() => ({ whatsappAuth: auth }))
    .use(devicesRoutes)
}

// ─── Tests ─────────────────────────────────────────────────────────────────────────

describe("devices routes", () => {
  beforeEach(() => {
    mockFindUnique.mockImplementation(async () => null)
    mockFindMany.mockImplementation(async () => [])
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
    ])

    const app = createTestApp(createAuthContext({ tenantRole: "admin" }))

    const response = await app.handle(new Request("http://localhost/"))

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; devices: unknown[] }
    expect(payload.ok).toBe(true)
    expect(payload.devices).toHaveLength(1)
  })

  it("returns empty list when no devices", async () => {
    const app = createTestApp(createAuthContext({ tenantRole: "admin" }))

    const response = await app.handle(new Request("http://localhost/"))

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; devices: unknown[] }
    expect(payload.devices).toHaveLength(0)
  })

  // ── Get one ────────────────────────────────────────────────────────────────────

  it("returns 404 when device not found", async () => {
    const app = createTestApp(createAuthContext({ tenantRole: "admin" }))

    const response = await app.handle(new Request("http://localhost/dev_missing"))

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

    const app = createTestApp(createAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    }))

    const response = await app.handle(new Request("http://localhost/dev_other"))

    expect(response.status).toBe(403)
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Create ────────────────────────────────────────────────────────────────────

  it("returns 403 when non-super_admin tries to create", async () => {
    const app = createTestApp(createAuthContext({
      platformRole: "none",
      tenantRole: "admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/", {
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
    const app = createTestApp(createAuthContext({
      platformRole: "super_admin",
      organizationId: "org_admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumber: "+628****1111",
          businessId: "bid_1",
          accessToken: "token_1",
        }),
      })
    )

    // Elysia's default validation error returns 422 with type field
    expect(response.status).toBe(422)
    const payload = await response.json() as { type?: string }
    expect(payload.type).toBeDefined()
  })

  it("returns 422 for missing phoneNumber on create", async () => {
    const app = createTestApp(createAuthContext({
      platformRole: "super_admin",
      organizationId: "org_admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/", {
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
    const payload = await response.json() as { type?: string }
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

    const app = createTestApp(createAuthContext({
      platformRole: "super_admin",
      organizationId: "org_admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/", {
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
    const app = createTestApp(createAuthContext({
      platformRole: "super_admin",
      tenantRole: "admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/dev_missing", {
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

    const app = createTestApp(createAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/dev_other", {
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

    const app = createTestApp(createAuthContext({
      platformRole: "super_admin",
      tenantRole: "admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/dev_1", {
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
    const app = createTestApp(createAuthContext({
      platformRole: "super_admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/dev_1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { ok: boolean; message: string }
    expect(payload.ok).toBe(true)
    expect(payload.message).toBe("Device deleted.")
  })

  it("returns 403 when non-super_admin tries delete", async () => {
    const app = createTestApp(createAuthContext({
      platformRole: "none",
      tenantRole: "admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/dev_1", {
        method: "DELETE",
      })
    )

    expect(response.status).toBe(403)
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Verify ────────────────────────────────────────────────────────────────────

  it("returns 404 when verifying missing device", async () => {
    const app = createTestApp(createAuthContext({ tenantRole: "admin" }))

    const response = await app.handle(
      new Request("http://localhost/dev_missing/verify", {
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

    const app = createTestApp(createAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/dev_other/verify", {
        method: "POST",
      })
    )

    expect(response.status).toBe(403)
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })

  // ── Reconnect ─────────────────────────────────────────────────────────────────

  it("returns 404 when reconnecting missing device", async () => {
    const app = createTestApp(createAuthContext({ tenantRole: "admin" }))

    const response = await app.handle(
      new Request("http://localhost/dev_missing/reconnect", {
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

    const app = createTestApp(createAuthContext({
      organizationId: "org_1",
      tenantRole: "admin",
    }))

    const response = await app.handle(
      new Request("http://localhost/dev_other/reconnect", {
        method: "POST",
      })
    )

    expect(response.status).toBe(403)
    const payload = await response.json() as { ok: boolean; error: string }
    expect(payload.error).toBe("FORBIDDEN")
  })
})
