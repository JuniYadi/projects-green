import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"

class MockGithubIntegrationDisabledError extends Error {
  constructor() {
    super("GitHub App integration is disabled.")
    this.name = "GithubIntegrationDisabledError"
  }
}

const mockGithubServiceAssertEnabled = mock(() => {})
const mockCreateGithubService = mock(() => ({
  getFeatureStatus: () => ({
    feature: "github_app_integration" as const,
    envKey: "FEATURE_GITHUB_APP_INTEGRATION",
    enabled: true,
  }),
  assertEnabled: mockGithubServiceAssertEnabled,
}))

const mockWithAuth = mock(async () => ({
  user: {
    id: "user_123",
  },
  organizationId: "org_123",
}))

const mockIssueGithubInstallState = mock(async () => ({
  state: "state_token",
  payload: {
    workosUserId: "user_123",
    organizationId: "org_123",
    returnTo: "/console",
    nonce: "nonce",
    expiresAt: Date.now() + 60_000,
  },
}))

const mockGetGithubInstallUrl = mock(() => "https://github.com/install?state=s")

mock.module("@workos-inc/authkit-nextjs", () => {
  return {
    withAuth: mockWithAuth,
  }
})

mock.module("@/modules/github/github-install-state", () => {
  return {
    getSafeReturnTo: (returnTo: string | null | undefined) => {
      if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
        return "/console"
      }

      return returnTo
    },
    issueGithubInstallState: mockIssueGithubInstallState,
  }
})

mock.module("@/modules/github/github.service", () => {
  return {
    GithubIntegrationDisabledError: MockGithubIntegrationDisabledError,
    createGithubService: mockCreateGithubService,
    getGithubInstallUrl: mockGetGithubInstallUrl,
  }
})

describe("GET /api/integrations/github/install/start", () => {
  beforeEach(() => {
    mockGithubServiceAssertEnabled.mockClear()
    mockCreateGithubService.mockClear()
    mockWithAuth.mockClear()
    mockIssueGithubInstallState.mockClear()
    mockGetGithubInstallUrl.mockClear()

    mockGithubServiceAssertEnabled.mockImplementation(() => {})
    mockCreateGithubService.mockImplementation(() => ({
      getFeatureStatus: () => ({
        feature: "github_app_integration" as const,
        envKey: "FEATURE_GITHUB_APP_INTEGRATION",
        enabled: true,
      }),
      assertEnabled: mockGithubServiceAssertEnabled,
    }))
    mockWithAuth.mockImplementation(async () => ({
      user: { id: "user_123" },
      organizationId: "org_123",
    }))
    mockIssueGithubInstallState.mockImplementation(async () => ({
      state: "state_token",
      payload: {
        workosUserId: "user_123",
        organizationId: "org_123",
        returnTo: "/console",
        nonce: "nonce",
        expiresAt: Date.now() + 60_000,
      },
    }))
    mockGetGithubInstallUrl.mockImplementation(
      () => "https://github.com/install?state=s"
    )
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockGithubServiceAssertEnabled.mockImplementation(() => {
      throw new MockGithubIntegrationDisabledError()
    })

    const route = await import("@/app/api/integrations/github/install/start/route")
    const response = await route.GET(
      new NextRequest("http://localhost/api/integrations/github/install/start")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FEATURE_DISABLED")
    expect(mockWithAuth).not.toHaveBeenCalled()
  })

  it("returns 401 when request is unauthenticated", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: null,
      organizationId: null,
    }) as any)

    const route = await import("@/app/api/integrations/github/install/start/route")
    const response = await route.GET(
      new NextRequest("http://localhost/api/integrations/github/install/start")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("issues state and redirects user to GitHub install URL", async () => {
    const route = await import("@/app/api/integrations/github/install/start/route")
    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/install/start?returnTo=/console/app/deploy"
      )
    )

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://github.com/install?state=s"
    )
    expect(mockWithAuth).toHaveBeenCalledWith({ ensureSignedIn: true })
    expect(mockIssueGithubInstallState).toHaveBeenCalledWith({
      workosUserId: "user_123",
      organizationId: "org_123",
      returnTo: "/console/app/deploy",
      secret: "",
    })
    expect(mockGetGithubInstallUrl).toHaveBeenCalledWith({
      state: "state_token",
    })
  })
})
