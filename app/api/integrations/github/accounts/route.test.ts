import { beforeEach, describe, expect, it, mock } from "bun:test"

type AuthResult = {
  user: { id: string } | null
  organizationId: string | null
  role?: string | null
  roles?: string[] | null
}

type GithubAppAccountTest = {
  id: string
  githubInstallationId: number
  accountLogin: string
  accountType: string | null
  targetType: string | null
  installedAt: string
}

const mockWithAuth = mock(
  async (): Promise<AuthResult> => ({
    user: { id: "user_123" },
    organizationId: "org_123",
    role: "owner",
    roles: [],
  })
)
const mockListActiveGithubAppAccounts = mock(
  async (): Promise<GithubAppAccountTest[]> => []
)
const mockGetPlatformRoleForUser = mock(
  async (): Promise<"none" | "super_admin"> => "none"
)
const mockHasScopedSuperAdminClaim = mock(() => false)
const mockResolveTenantRoleFromClaims = mock(
  (): "owner" | "admin" | "member" | null => "owner"
)

mock.module("@workos-inc/authkit-nextjs", () => ({
  withAuth: mockWithAuth,
}))

mock.module("@/modules/credentials/app-credential.service", () => ({
  listActiveGithubAppAccounts: mockListActiveGithubAppAccounts,
}))

mock.module("@/lib/platform-role", () => ({
  getPlatformRoleForUser: mockGetPlatformRoleForUser,
}))

mock.module("@/modules/tenants/tenant-policy", () => ({
  hasScopedSuperAdminClaim: mockHasScopedSuperAdminClaim,
  resolveTenantRoleFromClaims: mockResolveTenantRoleFromClaims,
}))

describe("GET /api/integrations/github/accounts", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockListActiveGithubAppAccounts.mockClear()
    mockGetPlatformRoleForUser.mockClear()
    mockHasScopedSuperAdminClaim.mockClear()
    mockResolveTenantRoleFromClaims.mockClear()

    mockWithAuth.mockImplementation(async () => ({
      user: { id: "user_123" },
      organizationId: "org_123",
      role: "owner",
      roles: [],
    }))
    mockListActiveGithubAppAccounts.mockImplementation(async () => [])
    mockGetPlatformRoleForUser.mockImplementation(async () => "none")
    mockHasScopedSuperAdminClaim.mockImplementation(() => false)
    mockResolveTenantRoleFromClaims.mockImplementation(() => "owner")
  })

  it("returns organization-scoped account DTOs without secrets", async () => {
    mockListActiveGithubAppAccounts.mockImplementation(async () => [
      {
        id: "cred_active",
        githubInstallationId: 901,
        accountLogin: "acme",
        accountType: null,
        targetType: "Organization",
        installedAt: "2026-06-01T12:34:56.000Z",
      },
    ])

    const route = await import("@/app/api/integrations/github/accounts/route")
    const response = await route.GET()
    const body = (await response.json()) as {
      ok: boolean
      accounts: Array<Record<string, unknown>>
    }

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      accounts: [
        {
          id: "cred_active",
          githubInstallationId: 901,
          accountLogin: "acme",
          accountType: null,
          targetType: "Organization",
          installedAt: "2026-06-01T12:34:56.000Z",
        },
      ],
    })
    expect(body.accounts[0]).not.toHaveProperty("encryptedJSON")
    expect(body.accounts[0]).not.toHaveProperty("token")
    expect(mockListActiveGithubAppAccounts).toHaveBeenCalledWith("org_123")
  })

  it("returns empty accounts without organization and does not list credentials", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: { id: "user_123" },
      organizationId: null,
      role: "owner",
      roles: [],
    }))

    const route = await import("@/app/api/integrations/github/accounts/route")
    const response = await route.GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, accounts: [] })
    expect(mockListActiveGithubAppAccounts).not.toHaveBeenCalled()
  })

  it("preserves unauthenticated 401 authorization", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: null,
      organizationId: null,
      role: null,
      roles: [],
    }))

    const route = await import("@/app/api/integrations/github/accounts/route")
    const response = await route.GET()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, error: "UNAUTHORIZED" })
    expect(mockGetPlatformRoleForUser).not.toHaveBeenCalled()
    expect(mockListActiveGithubAppAccounts).not.toHaveBeenCalled()
  })

  it("preserves member 403 authorization", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: { id: "user_123" },
      organizationId: "org_123",
      role: "member",
      roles: [],
    }))
    mockResolveTenantRoleFromClaims.mockImplementation(() => "member")

    const route = await import("@/app/api/integrations/github/accounts/route")
    const response = await route.GET()

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      ok: false,
      error: "FORBIDDEN",
      message: "Insufficient permissions",
    })
    expect(mockListActiveGithubAppAccounts).not.toHaveBeenCalled()
  })

  it("preserves super-admin authorization", async () => {
    mockGetPlatformRoleForUser.mockImplementation(async () => "super_admin")
    mockResolveTenantRoleFromClaims.mockImplementation(() => "member")
    mockListActiveGithubAppAccounts.mockImplementation(async () => [])

    const route = await import("@/app/api/integrations/github/accounts/route")
    const response = await route.GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, accounts: [] })
    expect(mockListActiveGithubAppAccounts).toHaveBeenCalledWith("org_123")
  })
})
