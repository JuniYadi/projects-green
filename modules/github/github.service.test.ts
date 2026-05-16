import { describe, expect, it } from "bun:test"

import { createGithubRepositoryService } from "@/modules/github/github.service"
import type { GithubInstallationRecord } from "@/modules/github/github.types"

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
