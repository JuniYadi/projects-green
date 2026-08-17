import { beforeEach, describe, expect, it, mock } from "bun:test"

// ─── Leaf mocks (must be registered BEFORE module imports) ────────────────

const mockPlatformFindFirst = mock<
  (args: {
    where: { OR: Array<{ workosUserId?: string; email?: string }> }
  }) => Promise<{ role?: string | null } | null>
>(async () => null)

const mockOrgKeyFindFirst = mock<
  (args: unknown) => Promise<{
    id: string
    organizationId: string
    fingerprint: string
  } | null>
>(async () => null)
const mockOrgKeyUpdateMany = mock(async () => ({ count: 0 }))
const mockAuthApiKeyFindFirst = mock<
  (args: unknown) => Promise<{
    id: string
    name: string
    organizationId: string
    environment: string
    scopes: unknown
  } | null>
>(async () => null)
const mockAuthApiKeyUpdate = mock(async () => ({}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    authPlatformUserRole: { findFirst: mockPlatformFindFirst },
    authApiKey: {
      findFirst: mockAuthApiKeyFindFirst,
      update: mockAuthApiKeyUpdate,
    },
    whatsappOrganizationApiKey: {
      findFirst: mockOrgKeyFindFirst,
      updateMany: mockOrgKeyUpdateMany,
    },
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

// ─── Imports (after mocks registered) ────────────────────────────────────

const { resolveProxyAuth, resolveAuthContext } =
  await import("./resolve-proxy-auth")

const buildRequest = (headers: Record<string, string>) => {
  const req = new Request("http://localhost/api/whatsapp/conversations")
  const h = new Headers()
  for (const [k, v] of Object.entries(headers)) {
    h.set(k, v)
  }
  return new Proxy(req, {
    get(target, prop) {
      if (prop === "headers") return h
      return Reflect.get(target, prop)
    },
  }) as unknown as Request
}

// ─── Default state ───────────────────────────────────────────────────────

beforeEach(() => {
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

  mockOrgKeyFindFirst.mockReset()
  mockOrgKeyFindFirst.mockImplementation(async () => null)
  mockOrgKeyUpdateMany.mockReset()
  mockOrgKeyUpdateMany.mockImplementation(async () => ({ count: 0 }))
  mockAuthApiKeyFindFirst.mockReset()
  mockAuthApiKeyFindFirst.mockImplementation(async () => null)
  mockAuthApiKeyUpdate.mockReset()
  mockAuthApiKeyUpdate.mockImplementation(async () => ({}))
  process.env.API_KEY_HASH_SALT = "test-api-key-hash-salt"

  // No WorkOS session cookie configured — getWorkOSSession() returns null
  // immediately, so these requests fall through to the API-key branch.
  delete process.env.WORKOS_COOKIE_PASSWORD
})

// ─── Tests ───────────────────────────────────────────────────────────────

describe("resolveProxyAuth", () => {
  it("returns org and role from proxy headers, skips WorkOS membership lookup", async () => {
    const request = buildRequest({
      "x-workos-authed": "true",
      "x-workos-user-id": "user_1",
      "x-workos-user-email": "admin@example.com",
      "x-workos-organization-id": "org_1",
      "x-workos-session-role": "user_admin",
    })

    const result = await resolveProxyAuth(request)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.scope.organizationId).toBe("org_1")
      expect(result.scope.orgRole).toBe("admin")
    }
    // WorkOS membership lookup should NOT be called
    expect(mockListOrganizationMemberships).not.toHaveBeenCalled()
  })

  it("falls back to WorkOS membership lookup when no org header", async () => {
    mockListOrganizationMemberships.mockImplementation(async () => ({
      autoPagination: async () => [
        {
          id: "om_1",
          organizationId: "org_fallback",
          role: { slug: "user_member" },
        },
      ],
    }))

    const request = buildRequest({
      "x-workos-authed": "true",
      "x-workos-user-id": "user_2",
      "x-workos-user-email": "member@example.com",
      // No x-workos-organization-id — forces WorkOS lookup
    })

    const result = await resolveProxyAuth(request)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.scope.organizationId).toBe("org_fallback")
      expect(result.scope.orgRole).toBe("member")
    }
    expect(mockListOrganizationMemberships).toHaveBeenCalledTimes(2)
  })

  it("returns { ok: false } when x-workos-authed is not true", async () => {
    const request = buildRequest({})
    const result = await resolveProxyAuth(request)
    expect(result.ok).toBe(false)
  })
})

describe("resolveAuthContext — WhatsApp organization API key", () => {
  const orgKey = `wa_live_${"a".repeat(43)}`

  it("resolves a valid key to a member-level platform scope for its org", async () => {
    mockOrgKeyFindFirst.mockImplementation(async () => ({
      id: "wa_key_1",
      organizationId: "org_whatsapp",
      fingerprint: "wa_key_fingerprint",
    }))

    const request = buildRequest({ Authorization: `Bearer ${orgKey}` })
    const result = await resolveAuthContext(request)

    expect(result?.type).toBe("platform")
    if (result?.type === "platform") {
      expect(result.keyId).toBe("wa_key_1")
      expect(result.organizationId).toBe("org_whatsapp")
      expect(result.environment).toBe("LIVE")
      // Deliberately empty: must never satisfy requireTenantAdmin/
      // requireSuperAdmin, which both gate on "platform:admin" or "*".
      expect(result.scopes).toEqual([])
    }
    expect(result?.source).toBe("api_key")
  })

  it("rejects a malformed key without a database lookup", async () => {
    const request = buildRequest({ Authorization: "Bearer wa_live_bad" })
    const result = await resolveAuthContext(request)

    expect(result).toBeNull()
    expect(mockOrgKeyFindFirst).not.toHaveBeenCalled()
  })

  it("rejects an unknown or revoked key", async () => {
    mockOrgKeyFindFirst.mockImplementation(async () => null)

    const request = buildRequest({ Authorization: `Bearer ${orgKey}` })
    const result = await resolveAuthContext(request)

    expect(result).toBeNull()
  })

  it("falls through to the live_/test_ API key path for non-wa_ tokens", async () => {
    // A well-formed org key never reaches resolveApiKey — only the prefix
    // check matters here, so a plain "live_" token must skip this branch
    // entirely and fall through to step 4 (unconfigured in this test, so
    // it resolves to null rather than throwing).
    const request = buildRequest({ Authorization: "Bearer live_something" })
    const result = await resolveAuthContext(request)

    expect(mockOrgKeyFindFirst).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})
