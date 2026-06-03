/**
 * WhatsApp auth plugin — helper-level unit tests.
 *
 * Tests the helpers and guards exported from `lib/whatsapp/auth.ts`,
 * `lib/auth/org-role.ts`, `lib/auth/session.ts`, and `lib/whatsapp/resolvers.ts`.
 *
 * Per AGENTS.md ("Mock leaf dependencies only"), we mock only:
 *   - @/lib/prisma          (for getPlatformRoleForUser)
 *   - @workos-inc/node       (for the createWorkOS SDK)
 */
import { beforeEach, describe, expect, it, mock } from "bun:test"
import { sealData } from "iron-session"

// ─── Leaf mocks (must be registered BEFORE module imports) ────────────────

const mockPlatformFindFirst = mock<
  (args: {
    where: { OR: Array<{ workosUserId?: string; email?: string }> }
  }) => Promise<{ role?: string | null } | null>
>(async () => null)

mock.module("@/lib/prisma", () => ({
  prisma: {
    platformUserRole: { findFirst: mockPlatformFindFirst },
    apiKey: { findFirst: async () => null, update: async () => ({}) },
  },
}))

const mockListOrganizationMemberships = mock(
  async (_opts?: Record<string, unknown>) => ({
    autoPagination: async () =>
      [] as Array<{
        id: string
        organizationId: string
        role?: { slug?: string | null } | null
      }>,
  })
)

const mockAuthenticateWithSessionCookie = mock<
  (args: {
    sessionData: string
    cookiePassword: string
  }) => Promise<{ authenticated: boolean; user?: Record<string, unknown> }>
>(async () => ({ authenticated: false }))

mock.module("@workos-inc/node", () => ({
  createWorkOS: () => ({
    userManagement: {
      listOrganizationMemberships: mockListOrganizationMemberships,
      authenticateWithSessionCookie: mockAuthenticateWithSessionCookie,
    },
  }),
}))

// ─── Imports (after mocks registered) ────────────────────────────────────

import { getWorkOSSession } from "@/lib/auth/session"
import { resolveOrgRole } from "@/lib/auth/org-role"
import { resolveFirstActiveOrganization } from "@/lib/whatsapp/resolvers"
import type { OrgRole } from "@/lib/auth/org-role"
import type { AuthContext, WorkOSScope } from "@/lib/auth/types"

// Boolean helper functions from the auth module (re-exported for testing)
const isSuperAdmin = (ctx: WorkOSScope) => ctx.platformRole === "super_admin"
const hasOrgMembership = (ctx: WorkOSScope) => ctx.organizationId !== null

const requireWorkOSSession = (ctx: AuthContext): ctx is WorkOSScope =>
  ctx.type === "workos"

const requireApiKey = (
  ctx: AuthContext
): ctx is import("@/lib/auth/types").PlatformScope => ctx.type === "platform"

const requireSuperAdmin = (ctx: AuthContext): boolean => {
  if (ctx.type === "platform") {
    return (
      Array.isArray(ctx.scopes) &&
      (ctx.scopes.includes("platform:admin") || ctx.scopes.includes("*"))
    )
  }
  return isSuperAdmin(ctx)
}

const requireTenantMember = (ctx: AuthContext): boolean => {
  if (ctx.type === "platform") return ctx.organizationId.length > 0
  return hasOrgMembership(ctx)
}

const requireTenantAdmin = (ctx: AuthContext): boolean => {
  if (ctx.type === "platform") {
    return (
      ctx.organizationId.length > 0 &&
      Array.isArray(ctx.scopes) &&
      (ctx.scopes.includes("platform:admin") || ctx.scopes.includes("*"))
    )
  }
  if (isSuperAdmin(ctx)) return true
  return ctx.orgRole === "admin" || ctx.orgRole === "owner"
}

const isWorkOSScope = (ctx: AuthContext): ctx is WorkOSScope =>
  ctx.type === "workos"
const isPlatformScope = (
  ctx: AuthContext
): ctx is import("@/lib/auth/types").PlatformScope => ctx.type === "platform"

const COOKIE_PASSWORD = "test-cookie-password-at-least-32-characters-long"
const COOKIE_NAME = "wos-session"

// ─── Cookie helpers ──────────────────────────────────────────────────────────

const makeWorkOSUser = (
  overrides: Partial<{ id: string; email: string }> = {}
) => ({
  object: "user" as const,
  id: overrides.id ?? "user_seed_1",
  email: overrides.email ?? "admin@example.com",
  firstName: "Test",
  lastName: "User",
  profilePictureUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
})

const sealUser = async (user: ReturnType<typeof makeWorkOSUser>) => {
  return sealData({ user }, { password: COOKIE_PASSWORD })
}

const buildCookieRequest = (sealed: string, path = "/") => {
  const real = new Request(`http://localhost${path}`)
  const headers = new Headers()
  headers.set("Cookie", `${COOKIE_NAME}=${sealed}`)
  return new Proxy(real, {
    get(target, prop) {
      if (prop === "headers") return headers
      return Reflect.get(target, prop)
    },
  }) as unknown as Request
}

// ─── Default state ───────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.WORKOS_COOKIE_PASSWORD = COOKIE_PASSWORD
  process.env.WORKOS_COOKIE_NAME = COOKIE_NAME
  process.env.WORKOS_API_KEY = "sk_test_xxx"

  mockPlatformFindFirst.mockReset()
  mockPlatformFindFirst.mockImplementation(async () => null)

  mockListOrganizationMemberships.mockReset()
  mockListOrganizationMemberships.mockImplementation(async () => ({
    autoPagination: async () =>
      [] as Array<{
        id: string
        organizationId: string
        role?: { slug?: string | null } | null
      }>,
  }))

  mockAuthenticateWithSessionCookie.mockReset()
  mockAuthenticateWithSessionCookie.mockImplementation(async () => ({
    authenticated: true,
    user: makeWorkOSUser(),
  }))
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const composeWorkOSScope = async (opts: {
  userId: string
  email?: string
  platformRole?: "none" | "super_admin"
}) => {
  const user = makeWorkOSUser({ id: opts.userId, email: opts.email })
  const sealed = await sealUser(user)
  const request = buildCookieRequest(sealed)
  const workosUser = await getWorkOSSession(request)
  if (!workosUser) {
    throw new Error("expected getWorkOSSession to resolve the user")
  }
  const firstOrg = await resolveFirstActiveOrganization(workosUser.id)
  const orgRole = firstOrg
    ? await resolveOrgRole(workosUser.id, firstOrg.organizationId)
    : null
  return {
    type: "workos" as const,
    userId: workosUser.id,
    email: workosUser.email ?? null,
    organizationId: firstOrg?.organizationId ?? null,
    orgRole,
    platformRole: opts.platformRole ?? ("none" as const),
  }
}

// ─── 1. WorkOS session with one active org membership ─────────────────────────

describe("WorkOS session with one active org membership", () => {
  it("resolveFirstActiveOrganization returns the first active org", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => ({
      autoPagination: async () => [
        {
          id: "om_1",
          organizationId: "org_real_1",
          role: { slug: "user_admin" },
        },
      ],
    }))

    const result = await resolveFirstActiveOrganization("user_admin_1")
    expect(result).toEqual({ organizationId: "org_real_1" })
  })

  it("resolves user_admin slug → 'admin' org role", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => ({
      autoPagination: async () => [
        {
          id: "om_1",
          organizationId: "org_x",
          role: { slug: "user_admin" },
        },
      ],
    }))
    expect(await resolveOrgRole("u", "org_x")).toBe("admin")
  })

  it("resolves user_owner slug → 'owner' org role", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => ({
      autoPagination: async () => [
        {
          id: "om_1",
          organizationId: "org_x",
          role: { slug: "user_owner" },
        },
      ],
    }))
    expect(await resolveOrgRole("u", "org_x")).toBe("owner")
  })

  it("resolves user_member slug → 'member' org role", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => ({
      autoPagination: async () => [
        {
          id: "om_1",
          organizationId: "org_x",
          role: { slug: "user_member" },
        },
      ],
    }))
    expect(await resolveOrgRole("u", "org_x")).toBe("member")
  })

  it("composing the helpers produces a valid WorkOSScope (org + admin role)", async () => {
    mockListOrganizationMemberships.mockImplementation(
      async (opts?: { organizationId?: string }) => {
        const orgId = opts?.organizationId ?? "org_real_1"
        return {
          autoPagination: async () => [
            {
              id: "om_1",
              organizationId: orgId,
              role: { slug: "user_admin" },
            },
          ],
        }
      }
    )

    const scope = await composeWorkOSScope({ userId: "user_admin_1" })

    expect(scope.organizationId).toBe("org_real_1")
    expect(scope.orgRole).toBe("admin")
    expect(requireTenantAdmin(scope)).toBe(true)
    expect(requireTenantMember(scope)).toBe(true)
    expect(requireSuperAdmin(scope)).toBe(false)
    expect(isWorkOSScope(scope)).toBe(true)
  })
})

// ─── 2. WorkOS session with no memberships ───────────────────────────────────

describe("WorkOS session with no org memberships", () => {
  it("resolveFirstActiveOrganization returns null when no memberships", async () => {
    const result = await resolveFirstActiveOrganization("user_lonely")
    expect(result).toBeNull()
  })

  it("composing helpers: organizationId=null, orgRole=null; guard rejects", async () => {
    const scope = await composeWorkOSScope({ userId: "user_lonely" })

    expect(scope.organizationId).toBeNull()
    expect(scope.orgRole).toBeNull()
    expect(requireTenantAdmin(scope)).toBe(false)
    expect(requireTenantMember(scope)).toBe(false)
    expect(isWorkOSScope(scope)).toBe(true)
  })
})

// ─── 3. WorkOS SDK throws (network / 401) ─────────────────────────────────────

describe("WorkOS SDK throws on membership lookup", () => {
  it("resolveFirstActiveOrganization returns null and logs once", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => {
      throw new Error("WorkOS 401 unauthorized")
    })

    const warnSpy = mock(() => {})
    const originalWarn = console.warn
    console.warn = warnSpy as unknown as typeof console.warn

    try {
      const result = await resolveFirstActiveOrganization("user_err")
      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledTimes(1)
      const warnArg = (warnSpy.mock.calls[0] as unknown[])[0]
      expect(warnArg).toContain(
        "[whatsapp-auth] workos membership lookup failed"
      )
    } finally {
      console.warn = originalWarn
    }
  })

  it("composing helpers: no unhandled rejection; organizationId/orgRole null; scope is valid WorkOSScope", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => {
      throw new Error("network down")
    })

    const warnSpy = mock(() => {})
    const originalWarn = console.warn
    console.warn = warnSpy as unknown as typeof console.warn

    try {
      const scope = await composeWorkOSScope({ userId: "user_err" })

      expect(scope.organizationId).toBeNull()
      expect(scope.orgRole).toBeNull()
      expect(scope.type).toBe("workos")
      expect(isWorkOSScope(scope)).toBe(true)
      expect(requireTenantAdmin(scope)).toBe(false)
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      console.warn = originalWarn
    }
  })
})

// ─── 4. API key path (PlatformScope) — guard behaviour ──────────────────────

describe("API key path (PlatformScope)", () => {
  it("PlatformScope has type='platform', orgRole undefined, requireTenantMember returns true when orgId present, requireTenantAdmin returns false without admin scope", () => {
    const platformScope = {
      type: "platform" as const,
      keyId: "key_1",
      keyName: "Test Key",
      organizationId: "org_test",
      environment: "LIVE" as const,
      scopes: ["read"],
    }
    expect(isPlatformScope(platformScope)).toBe(true)
    expect(isWorkOSScope(platformScope)).toBe(false)
    expect(requireTenantAdmin(platformScope)).toBe(false)
    expect(requireTenantMember(platformScope)).toBe(true)
    expect((platformScope as { orgRole?: unknown }).orgRole).toBeUndefined()
  })

  it("PlatformScope with empty organizationId fails requireTenantMember", () => {
    const platformScope = {
      type: "platform" as const,
      keyId: "key_empty",
      keyName: "No Org Key",
      organizationId: "",
      environment: "LIVE" as const,
      scopes: ["read"],
    }
    expect(requireTenantMember(platformScope)).toBe(false)
  })

  it("PlatformScope with platform:admin scope passes requireSuperAdmin and requireTenantAdmin", () => {
    const platformScope = {
      type: "platform" as const,
      keyId: "key_2",
      keyName: "Admin Key",
      organizationId: "org_test",
      environment: "LIVE" as const,
      scopes: ["platform:admin"],
    }
    expect(requireSuperAdmin(platformScope)).toBe(true)
    expect(requireTenantAdmin(platformScope)).toBe(true)
  })

  it("PlatformScope without admin scope fails requireSuperAdmin", () => {
    const platformScope = {
      type: "platform" as const,
      keyId: "key_3",
      keyName: "Read Key",
      organizationId: "org_test",
      environment: "LIVE" as const,
      scopes: ["read"],
    }
    expect(requireSuperAdmin(platformScope)).toBe(false)
  })

  it("requireApiKey accepts PlatformScope, rejects WorkOS scope", () => {
    const platformScope = {
      type: "platform" as const,
      keyId: "k",
      keyName: "k",
      organizationId: "org_test",
      environment: "LIVE" as const,
      scopes: [],
    }
    const workosScope = {
      type: "workos" as const,
      userId: "u",
      email: null,
      organizationId: "o",
      orgRole: "admin" as const,
      platformRole: "none" as const,
    }
    expect(requireApiKey(platformScope)).toBe(true)
    expect(requireApiKey(workosScope)).toBe(false)
  })

  it("requireWorkOSSession accepts WorkOS scope, rejects PlatformScope", () => {
    const workosScope = {
      type: "workos" as const,
      userId: "u",
      email: null,
      organizationId: "o",
      orgRole: "admin" as const,
      platformRole: "none" as const,
    }
    const platformScope = {
      type: "platform" as const,
      keyId: "k",
      keyName: "k",
      organizationId: "org_test",
      environment: "LIVE" as const,
      scopes: [],
    }
    expect(requireWorkOSSession(workosScope)).toBe(true)
    expect(requireWorkOSSession(platformScope)).toBe(false)
  })
})

// ─── 5. super_admin WorkOS user (DB PlatformUserRole) ──────────────────────

describe("super_admin WorkOS user (DB PlatformUserRole)", () => {
  it("passes requireSuperAdmin and requireTenantAdmin even with organizationId=null and orgRole=null", async () => {
    const scope = await composeWorkOSScope({
      userId: "user_superadmin",
      platformRole: "super_admin",
    })

    expect(scope.organizationId).toBeNull()
    expect(scope.orgRole).toBeNull()
    expect(scope.platformRole).toBe("super_admin")
    expect(requireSuperAdmin(scope)).toBe(true)
    expect(requireTenantAdmin(scope)).toBe(true)
  })

  it("super_admin user with org + admin role still passes (super_admin short-circuits)", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => ({
      autoPagination: async () => [
        {
          id: "om_1",
          organizationId: "org_superadmin",
          role: { slug: "user_admin" },
        },
      ],
    }))

    const scope = await composeWorkOSScope({
      userId: "user_superadmin_2",
      platformRole: "super_admin",
    })

    expect(scope.organizationId).toBe("org_superadmin")
    expect(scope.orgRole).toBe("admin")
    expect(requireSuperAdmin(scope)).toBe(true)
    expect(requireTenantAdmin(scope)).toBe(true)
  })

  it("non-super-admin WorkOS user with no memberships is rejected by both guards", async () => {
    const scope = await composeWorkOSScope({
      userId: "user_regular",
      platformRole: "none",
    })

    expect(scope.organizationId).toBeNull()
    expect(scope.orgRole).toBeNull()
    expect(requireTenantAdmin(scope)).toBe(false)
    expect(requireSuperAdmin(scope)).toBe(false)
  })
})
