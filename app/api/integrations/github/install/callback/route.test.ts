import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"

type AuthResult = {
  user: { id: string } | null
  organizationId: string | null
}

const mockWithAuth = mock(
  async (): Promise<AuthResult> => ({
    user: {
      id: "user_123",
    },
    organizationId: "org_123",
  })
)

class MockGithubIntegrationDisabledError extends Error {
  constructor() {
    super("GitHub App integration is disabled.")
    this.name = "GithubIntegrationDisabledError"
  }
}

class MockGithubInstallStateError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = "GithubInstallStateError"
  }
}

const mockValidateGithubInstallState = mock(async () => ({
  workosUserId: "user_123",
  organizationId: "org_123",
  returnTo: "/console/app/deploy",
  nonce: "nonce",
  expiresAt: Date.now() + 60_000,
}))

const mockFetchGithubInstallationDetails = mock(async () => ({
  id: 123,
  account: {
    login: "acme",
    type: "Organization",
  },
  target_type: "Organization",
  target_id: 999,
  permissions: {
    contents: "read",
  },
  events: ["push"],
}))

const mockFetchGithubInstallationRepositories = mock(async () => [
  {
    id: 555,
    full_name: "acme/platform",
    name: "platform",
    owner: {
      login: "acme",
    },
    default_branch: "main",
    private: true,
  },
])

const mockSyncGithubInstallation = mock(async () => ({
  id: "ghi_install_1",
}))
const mockGithubServiceAssertEnabled = mock(() => {})
const mockCreateGithubService = mock(() => ({
  getFeatureStatus: () => ({
    feature: "github_app_integration" as const,
    envKey: "FEATURE_GITHUB_APP_INTEGRATION",
    enabled: true,
  }),
  assertEnabled: mockGithubServiceAssertEnabled,
}))

mock.module("@workos-inc/authkit-nextjs", () => {
  return {
    withAuth: mockWithAuth,
  }
})

mock.module("@/modules/github/github-install-state", () => {
  return {
    GithubInstallStateError: MockGithubInstallStateError,
    getSafeReturnTo: (returnTo: string | null | undefined) => {
      if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
        return "/console"
      }

      return returnTo
    },
    validateGithubInstallState: mockValidateGithubInstallState,
  }
})

const mockGetStateSecret = mock(() => "")

mock.module("@/modules/github/github.service", () => {
  return {
    GithubIntegrationDisabledError: MockGithubIntegrationDisabledError,
    createGithubService: mockCreateGithubService,
    fetchGithubInstallationDetails: mockFetchGithubInstallationDetails,
    fetchGithubInstallationRepositories:
      mockFetchGithubInstallationRepositories,
    syncGithubInstallation: mockSyncGithubInstallation,
  }
})

describe("GET /api/integrations/github/install/callback", () => {
  beforeEach(() => {
    mockWithAuth.mockClear()
    mockValidateGithubInstallState.mockClear()
    mockFetchGithubInstallationDetails.mockClear()
    mockFetchGithubInstallationRepositories.mockClear()
    mockSyncGithubInstallation.mockClear()
    mockGithubServiceAssertEnabled.mockClear()
    mockCreateGithubService.mockClear()

    mockWithAuth.mockImplementation(async () => ({
      user: { id: "user_123" },
      organizationId: "org_123",
    }))
    mockGithubServiceAssertEnabled.mockImplementation(() => {})
    mockCreateGithubService.mockImplementation(() => ({
      getFeatureStatus: () => ({
        feature: "github_app_integration" as const,
        envKey: "FEATURE_GITHUB_APP_INTEGRATION",
        enabled: true,
      }),
      assertEnabled: mockGithubServiceAssertEnabled,
    }))

    mockValidateGithubInstallState.mockImplementation(async () => ({
      workosUserId: "user_123",
      organizationId: "org_123",
      returnTo: "/console/app/deploy?tab=source",
      nonce: "nonce",
      expiresAt: Date.now() + 60_000,
    }))
  })

  it("redirects to returnTo with github=connected and syncs installation", async () => {
    const route =
      await import("@/app/api/integrations/github/install/callback/route")

    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/install/callback?installation_id=123&state=valid"
      )
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost/console/app/deploy?tab=source&github=connected"
    )

    expect(mockWithAuth).toHaveBeenCalledWith({ ensureSignedIn: true })
    expect(mockValidateGithubInstallState).toHaveBeenCalledWith({
      state: "valid",
      secret: expect.any(String),
    })
    expect(mockFetchGithubInstallationDetails).toHaveBeenCalledWith(BigInt(123))
    expect(mockFetchGithubInstallationRepositories).toHaveBeenCalledWith(
      BigInt(123)
    )
    expect(mockSyncGithubInstallation).toHaveBeenCalledTimes(1)
    expect(mockSyncGithubInstallation).toHaveBeenCalledWith({
      installationId: BigInt(123),
      workosUserId: "user_123",
      organizationId: "org_123",
      installation: {
        account: { login: "acme", type: "Organization" },
        events: ["push"],
        id: 123,
        permissions: { contents: "read" },
        target_id: 999,
        target_type: "Organization",
      },
      repositories: [
        {
          default_branch: "main",
          full_name: "acme/platform",
          id: 555,
          name: "platform",
          owner: { login: "acme" },
          private: true,
        },
      ],
    })
  })

  it("redirects to github=error when state is invalid", async () => {
    mockValidateGithubInstallState.mockImplementation(async () => {
      throw new MockGithubInstallStateError(
        "INVALID_SIGNATURE",
        "bad signature"
      )
    })

    const route =
      await import("@/app/api/integrations/github/install/callback/route")

    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/install/callback?installation_id=123&state=bad"
      )
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost/console?github=error"
    )
    expect(mockSyncGithubInstallation).not.toHaveBeenCalled()
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockGithubServiceAssertEnabled.mockImplementation(() => {
      throw new MockGithubIntegrationDisabledError()
    })

    const route =
      await import("@/app/api/integrations/github/install/callback/route")

    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/install/callback?installation_id=123&state=valid"
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FEATURE_DISABLED")
    expect(mockWithAuth).not.toHaveBeenCalled()
  })

  it("returns 401 when there is no authenticated user", async () => {
    mockWithAuth.mockImplementation(
      async (): Promise<AuthResult> => ({
        user: null,
        organizationId: null,
      })
    )

    const route =
      await import("@/app/api/integrations/github/install/callback/route")

    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/install/callback?installation_id=123&state=valid"
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("redirects to github=error when state user does not match current session", async () => {
    mockValidateGithubInstallState.mockImplementation(async () => ({
      workosUserId: "user_999",
      organizationId: "org_123",
      returnTo: "/console/app/deploy",
      nonce: "nonce",
      expiresAt: Date.now() + 60_000,
    }))

    const route =
      await import("@/app/api/integrations/github/install/callback/route")

    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/install/callback?installation_id=123&state=valid"
      )
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost/console/app/deploy?github=error"
    )
    expect(mockSyncGithubInstallation).not.toHaveBeenCalled()
  })

  it("redirects to github=error when state organization does not match current session", async () => {
    mockValidateGithubInstallState.mockImplementation(async () => ({
      workosUserId: "user_123",
      organizationId: "org_other",
      returnTo: "/console/app/deploy?tab=source",
      nonce: "nonce",
      expiresAt: Date.now() + 60_000,
    }))

    const route =
      await import("@/app/api/integrations/github/install/callback/route")

    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/install/callback?installation_id=123&state=valid"
      )
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost/console/app/deploy?tab=source&github=error"
    )
    expect(mockSyncGithubInstallation).not.toHaveBeenCalled()
  })

  it("redirects to github=error when installation_id query is missing", async () => {
    const route =
      await import("@/app/api/integrations/github/install/callback/route")

    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/install/callback?state=valid"
      )
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "http://localhost/console?github=error"
    )
    expect(mockSyncGithubInstallation).not.toHaveBeenCalled()
  })
})
