import { describe, expect, it } from "bun:test"
import type { AuthContext, PlatformScope, WorkOSScope } from "./types"

const { guardOrgRead, guardOrgWrite, guardOrgFull, guardSuperAdmin } = await import(
  "./guards"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCtx = (auth?: AuthContext) => {
  const set: Record<string, unknown> = {}
  return { whatsappAuth: auth, set }
}

const mockRoute = async () => ({ success: true })

const platformKey = (scopes: string[]): PlatformScope => ({
  type: "platform",
  keyId: "key_123",
  keyName: "test-key",
  organizationId: "org_001",
  environment: "SANDBOX",
  scopes,
})

const workosSession = (
  overrides: Partial<WorkOSScope> = {}
): WorkOSScope => ({
  type: "workos",
  userId: "user_001",
  email: "user@example.com",
  organizationId: "org_001",
  orgRole: "member",
  platformRole: "none",
  ...overrides,
})

// ---------------------------------------------------------------------------
// guardOrgRead
// ---------------------------------------------------------------------------

describe("guardOrgRead", () => {
  it("returns 401 when no auth context", async () => {
    const ctx = makeCtx(undefined)
    const guarded = guardOrgRead(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(401)
    expect(result).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required.",
    })
  })

  it("calls route for platform API key", async () => {
    const ctx = makeCtx(platformKey(["read"]))
    const guarded = guardOrgRead(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })

  it("returns 403 when workos user has no org membership", async () => {
    const ctx = makeCtx(
      workosSession({ organizationId: null, orgRole: null })
    )
    const guarded = guardOrgRead(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Access restricted",
      required: "member",
      current: null,
      action: "You need to join an organization first.",
    })
  })

  it("calls route for workos user with org membership", async () => {
    const ctx = makeCtx(workosSession())
    const guarded = guardOrgRead(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })
})

// ---------------------------------------------------------------------------
// guardOrgWrite
// ---------------------------------------------------------------------------

describe("guardOrgWrite", () => {
  it("returns 401 when no auth context", async () => {
    const ctx = makeCtx(undefined)
    const guarded = guardOrgWrite(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(401)
    expect(result).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required.",
    })
  })

  it("returns 403 for platform key without admin or wildcard scope", async () => {
    const ctx = makeCtx(platformKey(["read"]))
    const guarded = guardOrgWrite(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Access restricted",
      required: "admin",
      current: null,
      action: "This operation requires a platform:admin scoped API key.",
    })
  })

  it("calls route for platform key with platform:admin scope", async () => {
    const ctx = makeCtx(platformKey(["platform:admin"]))
    const guarded = guardOrgWrite(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })

  it("calls route for platform key with wildcard scope", async () => {
    const ctx = makeCtx(platformKey(["*"]))
    const guarded = guardOrgWrite(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })

  it("calls route for workos super admin", async () => {
    const ctx = makeCtx(
      workosSession({ platformRole: "super_admin", orgRole: "member" })
    )
    const guarded = guardOrgWrite(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })

  it("returns 403 for workos user without org membership", async () => {
    const ctx = makeCtx(
      workosSession({ organizationId: null, orgRole: null })
    )
    const guarded = guardOrgWrite(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Access restricted",
      required: "admin",
      current: null,
      action: "You need to join an organization first.",
    })
  })

  it("returns 403 for workos user with member role (not admin+)", async () => {
    const ctx = makeCtx(workosSession({ orgRole: "member" }))
    const guarded = guardOrgWrite(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Access restricted",
      required: "admin",
      current: "member",
      action: "Request an upgrade from your organization owner.",
    })
  })

  it("calls route for workos user with admin role", async () => {
    const ctx = makeCtx(workosSession({ orgRole: "admin" }))
    const guarded = guardOrgWrite(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })
})

// ---------------------------------------------------------------------------
// guardOrgFull
// ---------------------------------------------------------------------------

describe("guardOrgFull", () => {
  it("returns 401 when no auth context", async () => {
    const ctx = makeCtx(undefined)
    const guarded = guardOrgFull(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(401)
    expect(result).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required.",
    })
  })

  it("returns 403 for platform key without admin or wildcard scope", async () => {
    const ctx = makeCtx(platformKey(["read"]))
    const guarded = guardOrgFull(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Access restricted",
      required: "owner",
      current: null,
      action: "This operation requires a platform:admin scoped API key.",
    })
  })

  it("calls route for platform key with platform:admin scope", async () => {
    const ctx = makeCtx(platformKey(["platform:admin"]))
    const guarded = guardOrgFull(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })

  it("calls route for platform key with wildcard scope", async () => {
    const ctx = makeCtx(platformKey(["*"]))
    const guarded = guardOrgFull(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })

  it("calls route for workos super admin", async () => {
    const ctx = makeCtx(
      workosSession({ platformRole: "super_admin", orgRole: "member" })
    )
    const guarded = guardOrgFull(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })

  it("returns 403 for workos user without org membership", async () => {
    const ctx = makeCtx(
      workosSession({ organizationId: null, orgRole: null })
    )
    const guarded = guardOrgFull(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Access restricted",
      required: "owner",
      current: null,
      action: "You need to join an organization first.",
    })
  })

  it("returns 403 for workos user with admin role (not owner)", async () => {
    const ctx = makeCtx(workosSession({ orgRole: "admin" }))
    const guarded = guardOrgFull(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Access restricted",
      required: "owner",
      current: "admin",
      action: "Request ownership transfer from your organization owner.",
    })
  })

  it("calls route for workos user with owner role", async () => {
    const ctx = makeCtx(workosSession({ orgRole: "owner" }))
    const guarded = guardOrgFull(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })
})

// ---------------------------------------------------------------------------
// guardSuperAdmin
// ---------------------------------------------------------------------------

describe("guardSuperAdmin", () => {
  it("returns 401 when no auth context", async () => {
    const ctx = makeCtx(undefined)
    const guarded = guardSuperAdmin(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(401)
    expect(result).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Authentication required.",
    })
  })

  it("returns 403 for platform key without admin or wildcard scope", async () => {
    const ctx = makeCtx(platformKey(["read"]))
    const guarded = guardSuperAdmin(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "super_admin role required.",
    })
  })

  it("calls route for platform key with platform:admin scope", async () => {
    const ctx = makeCtx(platformKey(["platform:admin"]))
    const guarded = guardSuperAdmin(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })

  it("calls route for platform key with wildcard scope", async () => {
    const ctx = makeCtx(platformKey(["*"]))
    const guarded = guardSuperAdmin(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })

  it("returns 403 for workos user with platformRole 'none'", async () => {
    const ctx = makeCtx(workosSession({ platformRole: "none" }))
    const guarded = guardSuperAdmin(mockRoute)
    const result = await guarded(ctx)
    expect(ctx.set.status).toBe(403)
    expect(result).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "super_admin role required.",
    })
  })

  it("calls route for workos user with platformRole 'super_admin'", async () => {
    const ctx = makeCtx(
      workosSession({ platformRole: "super_admin" })
    )
    const guarded = guardSuperAdmin(mockRoute)
    const result = await guarded(ctx)
    expect(result).toEqual({ success: true })
  })
})
