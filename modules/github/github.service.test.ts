import { afterEach, describe, expect, it } from "bun:test"

import {
  createGithubService,
  GithubIntegrationDisabledError,
  syncGithubInstallation,
} from "@/modules/github/github.service"

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
      installationId: 123n,
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
        githubInstallationId: 123n,
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
          githubRepositoryId: 111n,
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
          notIn: [111n, 222n],
        },
      },
    })
  })
})
