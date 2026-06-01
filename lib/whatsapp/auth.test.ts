/**
 * WhatsApp auth plugin — helper-level unit tests.
 *
 * Scope: unit tests for the helpers and guards exported from
 * `lib/whatsapp/auth.ts`. The full Elysia plugin derive is
 * integration-tested end-to-end via:
 *   - test/whatsapp-messages.e2e.test.ts
 *   - test/whatsapp-devices.e2e.test.ts
 *   - test/whatsapp-webhook.e2e.test.ts
 *
 * Per AGENTS.md ("Mock leaf dependencies only"), we mock only:
 *   - @/lib/prisma          (for getPlatformRoleForUser)
 *   - @workos-inc/node       (for the createWorkOS SDK)
 *
 * Cross-file mock note: the e2e tests in test/*.e2e.test.ts install
 * `mock.module("@/lib/whatsapp/auth", () => whatsappAuthMock)` which
 * permanently replaces the auth module for the `bun test` process.
 * To get the *real* auth module under those conditions, this file
 * reads `lib/whatsapp/auth.ts` from disk and evaluates it in a
 * fresh module scope via Bun.Transpiler. This way the helpers and
 * guards under test are the real exports from auth.ts, not a mock
 * or a re-implementation.
 */
import { beforeEach, describe, expect, it, mock } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as ironSession from "iron-session"
import { Elysia } from "elysia"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { TENANT_ROLES } from "@/modules/tenants/tenant-policy"

const { sealData } = ironSession

const COOKIE_PASSWORD = "test-cookie-password-at-least-32-characters-long"
const COOKIE_NAME = "wos-session"

// ─── Leaf mocks (must be registered BEFORE auth source is evaluated) ────────

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

mock.module("@workos-inc/node", () => ({
  createWorkOS: () => ({
    userManagement: {
      listOrganizationMemberships: mockListOrganizationMemberships,
    },
  }),
}))

// ─── Load REAL auth module by transpiling + evaluating the source ──────────
//
// This bypasses `mock.module("@/lib/whatsapp/auth", ...)` pollution
// from existing e2e tests because we never go through Bun's module
// cache for the auth module.

const AUTH_SOURCE_PATH = path.resolve(import.meta.dir, "auth.ts")
const authSource = fs.readFileSync(AUTH_SOURCE_PATH, "utf-8")
const transpiler = new Bun.Transpiler({ loader: "ts" })
const authJs = transpiler.transformSync(authSource)

// Convert ESM to CJS so we can eval with `new Function`.
const authCjs = authJs
  .replace(/^export\s+declare\s+/gm, "")
  .replace(/^export\s+default\s+/gm, "")
  .replace(/^export\s+type\s+/gm, "type ")
  .replace(/^export\s+interface\s+/gm, "interface ")
  .replace(/^export\s+const\s+/gm, "const ")
  .replace(/^export\s+function\s+/gm, "function ")
  .replace(/^export\s+async\s+function\s+/gm, "async function ")
  .replace(/^export\s+\{[^}]*\};?\s*$/gm, "")
  .replace(
    /^import\s+(\w+)\s+from\s+["']([^"']+)["'];?$/gm,
    'const $1 = require("$2");'
  )
  .replace(
    /^import\s+\{\s*([^}]+)\s*\}\s+from\s+["']([^"']+)["'];?$/gm,
    'const { $1 } = require("$2");'
  )
  .replace(
    /^import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["'];?$/gm,
    'const $1 = require("$2");'
  )

// Collect the names of all top-level const/function declarations to re-export.
const exportNames = new Set<string>()
for (const m of authJs.matchAll(/^export\s+const\s+(\w+)/gm)) exportNames.add(m[1])
for (const m of authJs.matchAll(/^export\s+function\s+(\w+)/gm))
  exportNames.add(m[1])
for (const m of authJs.matchAll(/^export\s+\{\s*([^}]+)\s*\}/gm)) {
  for (const part of m[1].split(",")) {
    const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim()
    if (trimmed) exportNames.add(trimmed)
  }
}

// Build the wrapper: run the code, then expose all named exports.
const wrapper = `${authCjs}
module.exports = { ${[...exportNames].join(", ")} };
`

const authModule: { exports: Record<string, unknown> } = { exports: {} }

// Build a custom require that injects our leaf mocks so the
// transpiled auth module calls our mock @workos-inc/node and our
// mock @/lib/prisma instead of the real implementations.
const leafMocks: Record<string, unknown> = {
  "@/lib/prisma": {
    prisma: {
      platformUserRole: { findFirst: mockPlatformFindFirst },
      apiKey: { findFirst: async () => null, update: async () => ({}) },
    },
  },
  "@workos-inc/node": {
    createWorkOS: () => ({
      userManagement: {
        listOrganizationMemberships: mockListOrganizationMemberships,
      },
    }),
  },
  "@workos-inc/authkit-nextjs": {
    withAuth: async () => ({ user: null, organizationId: null }),
  },
  "iron-session": ironSession,
  elysia: { Elysia },
  "@/lib/platform-role": { getPlatformRoleForUser },
  "@/modules/tenants/tenant-policy": { TENANT_ROLES },
  "@prisma/client": { ApiKeyEnvironment: { SANDBOX: "SANDBOX", LIVE: "LIVE" } },
}

const customRequire = (id: string) => {
  if (Object.prototype.hasOwnProperty.call(leafMocks, id)) {
    return leafMocks[id]
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(id)
}

const evaluator = new Function("module", "exports", "require", wrapper)
evaluator(authModule, authModule.exports, customRequire)

const auth = authModule.exports as typeof import("./auth")

const {
  getWorkOSSession,
  resolveFirstActiveOrganization,
  resolveTenantRole,
  requireTenantAdmin,
  requireTenantMember,
  requireSuperAdmin,
  requireApiKey,
  requireWorkOSSession,
  isWorkOSScope,
  isPlatformScope,
} = auth

// Sanity: the real auth module must export the helpers we test. If the
// e2e test's mock has somehow leaked in, the bundle will be missing
// them and the suite fails fast with a clear message.
if (
  typeof getWorkOSSession !== "function" ||
  typeof resolveFirstActiveOrganization !== "function" ||
  typeof resolveTenantRole !== "function"
) {
  throw new Error(
    "auth.test.ts: failed to load real auth module — got the e2e mock " +
      "instead. Check that the transpile step above produced the right " +
      "exports. Got keys: " +
      Object.keys(auth).join(", ")
  )
}

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

const buildBearerRequest = (bearer: string, path = "/") => {
  return new Request(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  })
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
  const tenantRole = firstOrg
    ? await resolveTenantRole(workosUser.id, firstOrg.organizationId)
    : null
  return {
    type: "workos" as const,
    userId: workosUser.id,
    email: workosUser.email ?? null,
    organizationId: firstOrg?.organizationId ?? null,
    tenantRole,
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

  it("resolves user_admin slug → 'admin' tenant role", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => ({
      autoPagination: async () => [
        {
          id: "om_1",
          organizationId: "org_x",
          role: { slug: "user_admin" },
        },
      ],
    }))
    expect(await resolveTenantRole("u", "org_x")).toBe("admin")
  })

  it("resolves user_owner slug → 'owner' tenant role", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => ({
      autoPagination: async () => [
        {
          id: "om_1",
          organizationId: "org_x",
          role: { slug: "user_owner" },
        },
      ],
    }))
    expect(await resolveTenantRole("u", "org_x")).toBe("owner")
  })

  it("resolves user_member slug → 'member' tenant role", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => ({
      autoPagination: async () => [
        {
          id: "om_1",
          organizationId: "org_x",
          role: { slug: "user_member" },
        },
      ],
    }))
    expect(await resolveTenantRole("u", "org_x")).toBe("member")
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
    expect(scope.tenantRole).toBe("admin")
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

  it("composing helpers: organizationId=null, tenantRole=null; guard rejects", async () => {
    const scope = await composeWorkOSScope({ userId: "user_lonely" })

    expect(scope.organizationId).toBeNull()
    expect(scope.tenantRole).toBeNull()
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

  it("composing helpers: no unhandled rejection; organizationId/tenantRole null; scope is valid WorkOSScope", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => {
      throw new Error("network down")
    })

    const warnSpy = mock(() => {})
    const originalWarn = console.warn
    console.warn = warnSpy as unknown as typeof console.warn

    try {
      const scope = await composeWorkOSScope({ userId: "user_err" })

      expect(scope.organizationId).toBeNull()
      expect(scope.tenantRole).toBeNull()
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
  it("PlatformScope has type='platform', tenantRole undefined, guardTenantAdmin returns false", () => {
    const platformScope = {
      type: "platform" as const,
      keyId: "key_1",
      keyName: "Test Key",
      environment: "LIVE" as const,
      scopes: ["read"],
    }
    expect(isPlatformScope(platformScope)).toBe(true)
    expect(isWorkOSScope(platformScope)).toBe(false)
    expect(requireTenantAdmin(platformScope)).toBe(false)
    expect(requireTenantMember(platformScope)).toBe(false)
    expect(
      (platformScope as { tenantRole?: unknown }).tenantRole
    ).toBeUndefined()
  })

  it("PlatformScope with platform:admin scope passes requireSuperAdmin", () => {
    const platformScope = {
      type: "platform" as const,
      keyId: "key_2",
      keyName: "Admin Key",
      environment: "LIVE" as const,
      scopes: ["platform:admin"],
    }
    expect(requireSuperAdmin(platformScope)).toBe(true)
  })

  it("PlatformScope without admin scope fails requireSuperAdmin", () => {
    const platformScope = {
      type: "platform" as const,
      keyId: "key_3",
      keyName: "Read Key",
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
      environment: "LIVE" as const,
      scopes: [],
    }
    const workosScope = {
      type: "workos" as const,
      userId: "u",
      email: null,
      organizationId: "o",
      tenantRole: "admin" as const,
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
      tenantRole: "admin" as const,
      platformRole: "none" as const,
    }
    const platformScope = {
      type: "platform" as const,
      keyId: "k",
      keyName: "k",
      environment: "LIVE" as const,
      scopes: [],
    }
    expect(requireWorkOSSession(workosScope)).toBe(true)
    expect(requireWorkOSSession(platformScope)).toBe(false)
  })

  it("getWorkOSSession rejects wos_-prefixed bearers it cannot unseal", async () => {
    const request = buildBearerRequest("wos_garbage", "/")
    const result = await getWorkOSSession(request)
    expect(result).toBeNull()
  })

  it("getWorkOSSession returns the sealed user from a valid cookie", async () => {
    const user = makeWorkOSUser({ id: "user_cookie_1" })
    const sealed = await sealUser(user)
    const request = buildCookieRequest(sealed)
    const result = await getWorkOSSession(request)
    expect(result).not.toBeNull()
    expect(result!.id).toBe("user_cookie_1")
    expect(result!.email).toBe("admin@example.com")
  })
})

// ─── 5. super_admin WorkOS user (DB PlatformUserRole) ──────────────────────

describe("super_admin WorkOS user (DB PlatformUserRole)", () => {
  it("passes requireSuperAdmin and requireTenantAdmin even with organizationId=null and tenantRole=null", async () => {
    const scope = await composeWorkOSScope({
      userId: "user_superadmin",
      platformRole: "super_admin",
    })

    expect(scope.organizationId).toBeNull()
    expect(scope.tenantRole).toBeNull()
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
    expect(scope.tenantRole).toBe("admin")
    expect(requireSuperAdmin(scope)).toBe(true)
    expect(requireTenantAdmin(scope)).toBe(true)
  })

  it("non-super-admin WorkOS user with no memberships is rejected by both guards", async () => {
    const scope = await composeWorkOSScope({
      userId: "user_regular",
      platformRole: "none",
    })

    expect(scope.organizationId).toBeNull()
    expect(scope.tenantRole).toBeNull()
    expect(requireTenantAdmin(scope)).toBe(false)
    expect(requireSuperAdmin(scope)).toBe(false)
  })
})
