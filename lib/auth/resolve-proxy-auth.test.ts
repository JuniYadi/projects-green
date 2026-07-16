import { beforeEach, describe, expect, it, mock } from "bun:test"

// ─── Leaf mocks (must be registered BEFORE module imports) ────────────────

const mockPlatformFindFirst = mock<
  (args: {
    where: { OR: Array<{ workosUserId?: string; email?: string }> }
  }) => Promise<{ role?: string | null } | null>
>(async () => null)

mock.module("@/lib/prisma", () => ({
  prisma: {
    authPlatformUserRole: { findFirst: mockPlatformFindFirst },
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

const { resolveProxyAuth } = await import("./resolve-proxy-auth")

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
