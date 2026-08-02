import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { createHash, generateKeyPairSync } from "node:crypto"

const mockRedisGet = mock(async () => null as string | null)
const mockRedisSet = mock(async () => "OK")
const mockFetch = mock<typeof fetch>()

mock.module("@/lib/redis", () => ({
  redis: { get: mockRedisGet, set: mockRedisSet },
}))

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const validPrivateKeyBase64 = Buffer.from(
  privateKey.export({ type: "pkcs1", format: "pem" })
).toString("base64")

// Dynamic import is required so Redis mock loads before service infrastructure.
const {
  createGithubRepositoryService,
  createGithubService,
  fetchGithubInstallationRepositories,
  GithubIntegrationDisabledError,
  GithubReconnectRequiredError,
  listRepoFiles,
  syncGithubInstallation,
} = await import("@/modules/github/github.service")
import type { GithubInstallationRecord } from "@/modules/github/github.types"

const originalFlag = process.env.FEATURE_GITHUB_APP_INTEGRATION
const originalFetch = global.fetch
const originalGithubAppId = process.env.GITHUB_APP_ID
const originalGithubAppPrivateKeyBase64 =
  process.env.GITHUB_APP_PRIVATE_KEY_BASE64
const originalAppSecret = process.env.APP_SECRET

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof global.fetch
  process.env.GITHUB_APP_ID = "12345"
  process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = validPrivateKeyBase64
  process.env.APP_SECRET = "test-app-secret"
  mockFetch.mockReset()
  mockRedisGet.mockClear()
  mockRedisSet.mockClear()
  mockRedisGet.mockResolvedValue(null)
  mockRedisSet.mockResolvedValue("OK")
})

afterEach(() => {
  global.fetch = originalFetch
  if (originalFlag === undefined)
    delete process.env.FEATURE_GITHUB_APP_INTEGRATION
  else process.env.FEATURE_GITHUB_APP_INTEGRATION = originalFlag
  if (originalGithubAppId === undefined) delete process.env.GITHUB_APP_ID
  else process.env.GITHUB_APP_ID = originalGithubAppId
  if (originalGithubAppPrivateKeyBase64 === undefined)
    delete process.env.GITHUB_APP_PRIVATE_KEY_BASE64
  else
    process.env.GITHUB_APP_PRIVATE_KEY_BASE64 =
      originalGithubAppPrivateKeyBase64
  if (originalAppSecret === undefined) delete process.env.APP_SECRET
  else process.env.APP_SECRET = originalAppSecret
})
describe("installation token lifecycle", () => {
  it("uses cached token normally and caps provider-aware TTL", async () => {
    const { encrypt, serializeEncryptedField } =
      await import("@/lib/encryption")
    const encryptionKey = createHash("sha256")
      .update("test-app-secret")
      .digest()
    mockRedisGet.mockResolvedValue(
      serializeEncryptedField(encrypt("cached-token", encryptionKey))
    )
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "commit-sha" } }),
    } as Response)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tree: [] }),
    } as Response)

    await listRepoFiles({
      installationId: 101,
      owner: "acme",
      repo: "platform",
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)

    mockRedisGet.mockResolvedValue(null)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        token: "fresh-token",
        expires_at: new Date(Date.now() + 90_000).toISOString(),
      }),
    } as Response)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ object: { sha: "commit-sha" } }),
    } as Response)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tree: [] }),
    } as Response)

    await listRepoFiles({
      installationId: 101,
      owner: "acme",
      repo: "platform",
    })
    const ttl = (mockRedisSet.mock.calls[0] as unknown[] | undefined)?.[3]
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(90)
    expect(ttl).toBeLessThanOrEqual(3300)
  })

  it("force refreshes callback token and rejects empty provider token", async () => {
    const { encrypt, serializeEncryptedField } =
      await import("@/lib/encryption")
    const encryptionKey = createHash("sha256")
      .update("test-app-secret")
      .digest()
    mockRedisGet.mockResolvedValue(
      serializeEncryptedField(encrypt("stale-token", encryptionKey))
    )
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "callback-fresh", expires_at: null }),
    } as Response)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ repositories: [] }),
    } as Response)

    await fetchGithubInstallationRepositories(BigInt(101))
    expect(mockRedisGet).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(2)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "", expires_at: null }),
    } as Response)
    await expect(
      fetchGithubInstallationRepositories(BigInt(101))
    ).rejects.toThrow("empty installation token")
  })
})

describe("githubService", () => {
  it("reports feature metadata and enabled state", () => {
    process.env.FEATURE_GITHUB_APP_INTEGRATION = "true"

    const service = createGithubService()
    const status = service.getFeatureStatus()

    expect(status.feature).toBe("github_app_integration")
    expect(status.envKey).toBe("FEATURE_GITHUB_APP_INTEGRATION")
    expect(status.enabled).toBe(true)
  })

  it("throws when assertEnabled is called while disabled", () => {
    process.env.FEATURE_GITHUB_APP_INTEGRATION = "false"

    const service = createGithubService()

    expect(() => service.assertEnabled()).toThrowError(
      GithubIntegrationDisabledError
    )
  })
})

describe("syncGithubInstallation", () => {
  it("upserts installation and syncs repository snapshot", async () => {
    const installationUpserts: unknown[] = []
    const repositoryUpserts: unknown[] = []
    const repositoryDeletes: unknown[] = []

    const prismaClient = {
      $transaction: async (
        fn: (tx: {
          githubInstallation: {
            upsert: (args: unknown) => Promise<{ id: string }>
          }
          githubRepositoryConnection: {
            upsert: (args: unknown) => Promise<void>
            deleteMany: (args: unknown) => Promise<void>
          }
        }) => Promise<unknown>
      ) => {
        return fn({
          githubInstallation: {
            upsert: async (args) => {
              installationUpserts.push(args)
              return { id: "install_rec_1" }
            },
          },
          githubRepositoryConnection: {
            upsert: async (args) => {
              repositoryUpserts.push(args)
            },
            deleteMany: async (args) => {
              repositoryDeletes.push(args)
            },
          },
        })
      },
    }

    await syncGithubInstallation({
      installationId: BigInt(123),
      workosUserId: "user_123",
      organizationId: "org_123",
      installation: {
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
      },
      repositories: [
        {
          id: 111,
          full_name: "acme/service-a",
          name: "service-a",
          owner: {
            login: "acme",
          },
          default_branch: "main",
          private: true,
        },
        {
          id: 222,
          full_name: "acme/service-b",
          name: "service-b",
          owner: {
            login: "acme",
          },
          default_branch: "master",
          private: false,
        },
      ],
      prismaClient: prismaClient as Parameters<
        typeof syncGithubInstallation
      >[0]["prismaClient"],
    })

    expect(installationUpserts.length).toBe(1)
    expect(repositoryUpserts.length).toBe(2)
    expect(repositoryDeletes.length).toBe(1)

    expect(installationUpserts[0]).toMatchObject({
      where: {
        githubInstallationId: BigInt(123),
      },
      create: {
        workosUserId: "user_123",
        organizationId: "org_123",
        accountLogin: "acme",
      },
    })

    expect(repositoryUpserts[0]).toMatchObject({
      where: {
        githubRepositoryId_installationId: {
          githubRepositoryId: BigInt(111),
          installationId: "install_rec_1",
        },
      },
      create: {
        fullName: "acme/service-a",
        ownerLogin: "acme",
        repoName: "service-a",
        defaultBranch: "main",
        isPrivate: true,
      },
    })

    expect(repositoryDeletes[0]).toMatchObject({
      where: {
        installationId: "install_rec_1",
        githubRepositoryId: {
          notIn: [BigInt(111), BigInt(222)],
        },
      },
    })
  })
})

const installations: GithubInstallationRecord[] = [
  {
    githubInstallationId: 101,
    accountLogin: "acme",
    targetId: 5001,
  },
  {
    githubInstallationId: 202,
    accountLogin: "orbit",
    targetId: 5002,
  },
]

describe("githubRepositoryService", () => {
  it("returns active installations for actor", async () => {
    const service = createGithubRepositoryService({
      async listActiveInstallations(actor) {
        if (actor.organizationId === "org_1") {
          return [installations[0]]
        }
        return [installations[1]]
      },
      async createInstallationAccessToken() {
        return "token"
      },
      async listRepositoriesForInstallation() {
        return []
      },
      async invalidateInstallationAccessToken() {},
      async deactivateInstallation() {},
    })

    const result = await service.listInstallationsForActor({
      userId: "user_1",
      organizationId: "org_1",
    })

    expect(result).toEqual([installations[0]])
  })
  it("supports filtering and cursor pagination with nextCursor", async () => {
    const service = createGithubRepositoryService({
      async listActiveInstallations() {
        return installations
      },
      async createInstallationAccessToken(installationId) {
        return `token-${installationId}`
      },
      async listRepositoriesForInstallation(installation) {
        if (installation.githubInstallationId === 101) {
          return [
            {
              repositoryId: 1,
              fullName: "acme/service-api",
              name: "service-api",
              owner: "acme",
              installationId: 101,
              defaultBranch: "main",
              private: true,
              pushedAt: "2026-05-16T03:10:45.000Z",
            },
            {
              repositoryId: 2,
              fullName: "acme/service-web",
              name: "service-web",
              owner: "acme",
              installationId: 101,
              defaultBranch: "main",
              private: false,
              pushedAt: "2026-05-16T01:10:45.000Z",
            },
          ]
        }

        return [
          {
            repositoryId: 3,
            fullName: "orbit/tools",
            name: "tools",
            owner: "orbit",
            installationId: 202,
            defaultBranch: "main",
            private: true,
            pushedAt: "2026-05-15T01:10:45.000Z",
          },
        ]
      },
      async invalidateInstallationAccessToken() {},
      async deactivateInstallation() {},
    })

    const firstPage = await service.listRepositoriesForActor(
      {
        userId: "user_1",
        organizationId: "org_1",
      },
      {
        query: "service",
        limit: 1,
      }
    )

    expect(firstPage.items).toHaveLength(1)
    expect(firstPage.items[0]?.fullName).toBe("acme/service-api")
    expect(firstPage.nextCursor).toBeString()

    const secondPage = await service.listRepositoriesForActor(
      {
        userId: "user_1",
        organizationId: "org_1",
      },
      {
        query: "service",
        limit: 1,
        cursor: firstPage.nextCursor ?? undefined,
      }
    )

    expect(secondPage.items).toHaveLength(1)
    expect(secondPage.items[0]?.fullName).toBe("acme/service-web")
    expect(secondPage.nextCursor).toBeNull()
  })

  it("filters repositories by ownerId scoped to active installations", async () => {
    const service = createGithubRepositoryService({
      async listActiveInstallations(actor) {
        if (actor.organizationId === "org_1") {
          return [installations[0]]
        }

        return [installations[1]]
      },
      async createInstallationAccessToken(installationId) {
        return `token-${installationId}`
      },
      async listRepositoriesForInstallation(installation) {
        if (installation.githubInstallationId === 101) {
          return [
            {
              repositoryId: 11,
              fullName: "acme/private-repo",
              name: "private-repo",
              owner: "acme",
              installationId: 101,
              defaultBranch: "main",
              private: true,
              pushedAt: "2026-05-16T05:10:45.000Z",
            },
          ]
        }

        return [
          {
            repositoryId: 22,
            fullName: "orbit/ops-repo",
            name: "ops-repo",
            owner: "orbit",
            installationId: 202,
            defaultBranch: "main",
            private: true,
            pushedAt: "2026-05-16T04:10:45.000Z",
          },
        ]
      },
      async invalidateInstallationAccessToken() {},
      async deactivateInstallation() {},
    })

    const acmeOnly = await service.listRepositoriesForActor(
      {
        userId: "user_1",
        organizationId: "org_1",
      },
      {
        ownerId: "acme",
      }
    )

    expect(acmeOnly.items).toHaveLength(1)
    expect(acmeOnly.items[0]?.owner).toBe("acme")

    const orbitOnly = await service.listRepositoriesForActor(
      {
        userId: "user_1",
        organizationId: "org_2",
      },
      {
        ownerId: "orbit",
      }
    )

    expect(orbitOnly.items).toHaveLength(1)
    expect(orbitOnly.items[0]?.owner).toBe("orbit")
  })
  it("passes created token to installation repository listing", async () => {
    const calls: Array<{ installationId: number; token: string }> = []
    const repository = {
      repositoryId: 1,
      fullName: "acme/platform",
      name: "platform",
      owner: "acme",
      installationId: 101,
      defaultBranch: "main",
      private: true,
      pushedAt: "2026-05-16T03:10:45.000Z",
    }
    const service = createGithubRepositoryService({
      async listActiveInstallations() {
        return [installations[0]]
      },
      async createInstallationAccessToken(installationId) {
        expect(installationId).toBe(101)
        return "known-token"
      },
      async listRepositoriesForInstallation(installation, token) {
        calls.push({
          installationId: installation.githubInstallationId,
          token,
        })
        return [repository]
      },
      async invalidateInstallationAccessToken() {},
      async deactivateInstallation() {},
    })

    const result = await service.listRepositoriesForActor(
      { userId: "user_1", organizationId: "org_1" },
      {}
    )

    expect(result.items).toEqual([repository])
    expect(calls).toEqual([{ installationId: 101, token: "known-token" }])
  })
  it("invalidates cached token and retries once after reconnect error", async () => {
    const repository = {
      repositoryId: 1,
      fullName: "acme/platform",
      name: "platform",
      owner: "acme",
      installationId: 101,
      defaultBranch: "main",
      private: true,
      pushedAt: "2026-05-16T03:10:45.000Z",
    }
    const createInstallationAccessToken = mock(
      async (_installationId: number, forceRefresh = false) => {
        if (forceRefresh) {
          return "fresh-token"
        }

        return "cached-token"
      }
    )
    const invalidateInstallationAccessToken = mock(
      async (installationId: number) => {
        expect(installationId).toBe(101)
      }
    )
    const listRepositoriesForInstallation = mock(
      async (_installation: GithubInstallationRecord, token: string) => {
        if (token === "cached-token") {
          throw new GithubReconnectRequiredError(undefined, 401)
        }

        return [repository]
      }
    )
    const deactivateInstallation = mock(async () => {})
    const service = createGithubRepositoryService({
      async listActiveInstallations() {
        return [installations[0]]
      },
      createInstallationAccessToken,
      invalidateInstallationAccessToken,
      listRepositoriesForInstallation,
      deactivateInstallation,
    })

    const result = await service.listRepositoriesForActor(
      { userId: "user_1", organizationId: "org_1" },
      {}
    )

    expect(result.items).toEqual([repository])
    expect(invalidateInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(invalidateInstallationAccessToken).toHaveBeenCalledWith(101)
    expect(createInstallationAccessToken).toHaveBeenNthCalledWith(1, 101)
    expect(createInstallationAccessToken).toHaveBeenNthCalledWith(2, 101, true)
    expect(createInstallationAccessToken).toHaveBeenCalledTimes(2)
    expect(listRepositoriesForInstallation).toHaveBeenNthCalledWith(
      1,
      installations[0],
      "cached-token"
    )
    expect(listRepositoriesForInstallation).toHaveBeenNthCalledWith(
      2,
      installations[0],
      "fresh-token"
    )
    expect(listRepositoriesForInstallation).toHaveBeenCalledTimes(2)
    expect(deactivateInstallation).not.toHaveBeenCalled()
  })

  it("deactivates installation and throws reconnect error after retry fails", async () => {
    const reconnectError = new GithubReconnectRequiredError(undefined, 401)
    const createInstallationAccessToken = mock(async () => "cached-token")
    createInstallationAccessToken.mockResolvedValueOnce("cached-token")
    createInstallationAccessToken.mockResolvedValueOnce("fresh-token")
    const invalidateInstallationAccessToken = mock(async () => {})
    const listRepositoriesForInstallation = mock(
      async (_installation: GithubInstallationRecord, _token: string) => {
        throw reconnectError
      }
    )
    const deactivateInstallation = mock(async () => {})
    const service = createGithubRepositoryService({
      async listActiveInstallations() {
        return [installations[0]]
      },
      createInstallationAccessToken,
      invalidateInstallationAccessToken,
      listRepositoriesForInstallation,
      deactivateInstallation,
    })

    await expect(
      service.listRepositoriesForActor(
        { userId: "user_1", organizationId: "org_1" },
        {}
      )
    ).rejects.toThrow(GithubReconnectRequiredError)

    expect(invalidateInstallationAccessToken).toHaveBeenCalledTimes(1)
    expect(createInstallationAccessToken).toHaveBeenCalledTimes(2)
    expect(listRepositoriesForInstallation).toHaveBeenCalledTimes(2)
    expect(deactivateInstallation).toHaveBeenCalled()
  })

  it("deactivates stale installation and returns repos from valid installation", async () => {
    const validRepository = {
      repositoryId: 1,
      fullName: "acme/platform",
      name: "platform",
      owner: "acme",
      installationId: 202,
      defaultBranch: "main",
      private: true,
      pushedAt: "2026-05-16T03:10:45.000Z",
    }
    const createInstallationAccessToken = mock(
      async (installationId: number) => {
        if (installationId === 101) {
          throw new GithubReconnectRequiredError(undefined, 404)
        }
        return "valid-token"
      }
    )
    const invalidateInstallationAccessToken = mock(async () => {})
    const listRepositoriesForInstallation = mock(
      async (_installation: GithubInstallationRecord, _token: string) => {
        return [validRepository]
      }
    )
    const deactivateInstallation = mock(async (installationId: number) => {
      expect(installationId).toBe(101)
    })
    const service = createGithubRepositoryService({
      async listActiveInstallations() {
        return installations
      },
      createInstallationAccessToken,
      invalidateInstallationAccessToken,
      listRepositoriesForInstallation,
      deactivateInstallation,
    })

    const result = await service.listRepositoriesForActor(
      { userId: "user_1", organizationId: "org_1" },
      {}
    )

    expect(result.items).toEqual([validRepository])
    expect(deactivateInstallation).toHaveBeenCalledTimes(1)
    expect(deactivateInstallation).toHaveBeenCalledWith(101)
    expect(createInstallationAccessToken).toHaveBeenCalledTimes(2)
    expect(listRepositoriesForInstallation).toHaveBeenCalledTimes(1)
  })

  it("throws reconnect error when all installations fail", async () => {
    const createInstallationAccessToken = mock(
      async (_installationId: number) => {
        throw new GithubReconnectRequiredError(undefined, 404)
      }
    )
    const invalidateInstallationAccessToken = mock(async () => {})
    const listRepositoriesForInstallation = mock(async () => [])
    const deactivateInstallation = mock(async () => {})
    const service = createGithubRepositoryService({
      async listActiveInstallations() {
        return installations
      },
      createInstallationAccessToken,
      invalidateInstallationAccessToken,
      listRepositoriesForInstallation,
      deactivateInstallation,
    })

    await expect(
      service.listRepositoriesForActor(
        { userId: "user_1", organizationId: "org_1" },
        {}
      )
    ).rejects.toThrow(GithubReconnectRequiredError)

    expect(deactivateInstallation).toHaveBeenCalledTimes(2)
    expect(createInstallationAccessToken).toHaveBeenCalledTimes(2)
  })
})
