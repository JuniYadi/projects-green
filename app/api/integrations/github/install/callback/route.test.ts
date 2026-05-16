import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest } from "next/server"

const mockWithAuth = mock(async () => ({
  user: {
    id: "user_123",
  },
  organizationId: "org_123",
}))

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

mock.module("@/modules/github/github.service", () => {
  return {
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

    mockWithAuth.mockImplementation(async () => ({
      user: { id: "user_123" },
      organizationId: "org_123",
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
      secret: "",
    })
    expect(mockFetchGithubInstallationDetails).toHaveBeenCalledWith(123n)
    expect(mockFetchGithubInstallationRepositories).toHaveBeenCalledWith(123n)
    expect(mockSyncGithubInstallation).toHaveBeenCalledTimes(1)
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
})
