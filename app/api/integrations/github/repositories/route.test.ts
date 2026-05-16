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

const mockFindMany = mock(async () => [
  {
    id: "repo_conn_1",
    githubRepositoryId: BigInt(101),
    fullName: "acme/api",
    repoName: "api",
    ownerLogin: "acme",
    defaultBranch: "main",
    isPrivate: true,
    lastSyncedAt: new Date("2026-05-16T10:00:00.000Z"),
    installation: {
      githubInstallationId: BigInt(9001),
    },
  },
  {
    id: "repo_conn_2",
    githubRepositoryId: BigInt(102),
    fullName: "acme/web",
    repoName: "web",
    ownerLogin: "acme",
    defaultBranch: "main",
    isPrivate: false,
    lastSyncedAt: new Date("2026-05-16T11:00:00.000Z"),
    installation: {
      githubInstallationId: BigInt(9001),
    },
  },
  {
    id: "repo_conn_3",
    githubRepositoryId: BigInt(103),
    fullName: "acme/worker",
    repoName: "worker",
    ownerLogin: "acme",
    defaultBranch: "main",
    isPrivate: true,
    lastSyncedAt: new Date("2026-05-16T12:00:00.000Z"),
    installation: {
      githubInstallationId: BigInt(9001),
    },
  },
])

mock.module("@workos-inc/authkit-nextjs", () => {
  return {
    withAuth: mockWithAuth,
  }
})

mock.module("@/lib/prisma", () => {
  return {
    prisma: {
      githubRepositoryConnection: {
        findMany: mockFindMany,
      },
    },
  }
})

mock.module("@/modules/github/github.service", () => {
  return {
    GithubIntegrationDisabledError: MockGithubIntegrationDisabledError,
    createGithubService: mockCreateGithubService,
  }
})

describe("GET /api/integrations/github/repositories", () => {
  beforeEach(() => {
    mockGithubServiceAssertEnabled.mockClear()
    mockCreateGithubService.mockClear()
    mockWithAuth.mockClear()
    mockFindMany.mockClear()

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
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockGithubServiceAssertEnabled.mockImplementation(() => {
      throw new MockGithubIntegrationDisabledError()
    })

    const route = await import("@/app/api/integrations/github/repositories/route")
    const response = await route.GET(
      new NextRequest("http://localhost/api/integrations/github/repositories")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(404)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FEATURE_DISABLED")
    expect(mockWithAuth).not.toHaveBeenCalled()
  })

  it("returns 401 when user is unauthenticated", async () => {
    mockWithAuth.mockImplementation(async () => ({
      user: null,
      organizationId: null,
    }) as any)

    const route = await import("@/app/api/integrations/github/repositories/route")
    const response = await route.GET(
      new NextRequest("http://localhost/api/integrations/github/repositories")
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns 400 for invalid cursor", async () => {
    const route = await import("@/app/api/integrations/github/repositories/route")
    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/repositories?cursor=bad_cursor"
      )
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(400)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_QUERY")
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("applies owner/query filters, paginates with limit, and returns nextCursor", async () => {
    const route = await import("@/app/api/integrations/github/repositories/route")
    const response = await route.GET(
      new NextRequest(
        "http://localhost/api/integrations/github/repositories?ownerId=acme&query=api&limit=2&cursor=100"
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      items: Array<{
        id: string
        repositoryId: number
        fullName: string
        name: string
        owner: string
        installationId: number
        defaultBranch: string | null
        private: boolean
        pushedAt: string | null
      }>
      nextCursor: string | null
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.items).toEqual([
      {
        id: "repo_conn_1",
        repositoryId: 101,
        fullName: "acme/api",
        name: "api",
        owner: "acme",
        installationId: 9001,
        defaultBranch: "main",
        private: true,
        pushedAt: "2026-05-16T10:00:00.000Z",
      },
      {
        id: "repo_conn_2",
        repositoryId: 102,
        fullName: "acme/web",
        name: "web",
        owner: "acme",
        installationId: 9001,
        defaultBranch: "main",
        private: false,
        pushedAt: "2026-05-16T11:00:00.000Z",
      },
    ])
    expect(body.nextCursor).toBe("102")
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        githubRepositoryId: { gt: BigInt(100) },
        OR: [
          { fullName: { contains: "api", mode: "insensitive" } },
          { repoName: { contains: "api", mode: "insensitive" } },
        ],
        installation: {
          status: "active",
          workosUserId: "user_123",
          organizationId: "org_123",
          accountLogin: "acme",
        },
      },
      select: {
        id: true,
        githubRepositoryId: true,
        fullName: true,
        repoName: true,
        ownerLogin: true,
        defaultBranch: true,
        isPrivate: true,
        installation: {
          select: {
            githubInstallationId: true,
          },
        },
        lastSyncedAt: true,
      },
      orderBy: {
        githubRepositoryId: "asc",
      },
      take: 3,
    })
  })
})
