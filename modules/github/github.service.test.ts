import { afterEach, describe, expect, it } from "bun:test"

import {
  createGithubRepositoryService,
  createGithubService,
  GithubIntegrationDisabledError,
  syncGithubInstallation,
} from "@/modules/github/github.service"
import type { GithubInstallationRecord } from "@/modules/github/github.types"

const originalFlag = process.env.FEATURE_GITHUB_APP_INTEGRATION

afterEach(() => {
  if (originalFlag === undefined) {
    delete process.env.FEATURE_GITHUB_APP_INTEGRATION
    return
  }

  process.env.FEATURE_GITHUB_APP_INTEGRATION = originalFlag
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
})
