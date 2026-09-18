import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockCreateInstallationToken = mock(
  async (_id: bigint | number) => "ghs_mock_token_123"
)
mock.module("@/modules/github/github.service", () => ({
  createInstallationToken: mockCreateInstallationToken,
}))

const mockPrisma = {
  applicationDeployment: {
    findFirst: mock(),
  },
}
mock.module("@/lib/prisma", () => ({ prisma: mockPrisma }))

const { resolveEphemeralGitCredential, EphemeralGitTokenError } = await import(
  "./ephemeral-git-token.service"
)

describe("ephemeral-git-token.service", () => {
  const stackId = "stack-123"
  const deploymentId = "deploy-456"

  const validDeploymentRecord = {
    id: deploymentId,
    stackId,
    status: "BUILDING",
    stack: {
      id: stackId,
      repositoryConnection: {
        id: "repo-conn-1",
        fullName: "my-org/my-repo",
        repoName: "my-repo",
        installation: {
          id: "inst-1",
          githubInstallationId: 987654321n,
        },
      },
    },
  }

  beforeEach(() => {
    mockCreateInstallationToken.mockClear()
    mockPrisma.applicationDeployment.findFirst.mockReset()
    mockCreateInstallationToken.mockResolvedValue("ghs_mock_token_123")
    mockPrisma.applicationDeployment.findFirst.mockResolvedValue(
      validDeploymentRecord
    )
  })

  it("resolves ephemeral git credential when deployment is BUILDING", async () => {
    const creds = await resolveEphemeralGitCredential(stackId, deploymentId)

    expect(creds.provider).toBe("github")
    expect(creds.username).toBe("x-access-token")
    expect(creds.token).toBe("ghs_mock_token_123")
    expect(creds.cloneUrl).toBe("https://github.com/my-org/my-repo.git")
    expect(creds.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
    expect(mockCreateInstallationToken).toHaveBeenCalledWith(987654321n)
  })

  it("formats cloneUrl correctly if fullName already ends with .git", async () => {
    mockPrisma.applicationDeployment.findFirst.mockResolvedValue({
      ...validDeploymentRecord,
      stack: {
        ...validDeploymentRecord.stack,
        repositoryConnection: {
          ...validDeploymentRecord.stack.repositoryConnection,
          fullName: "my-org/my-repo.git",
        },
      },
    })

    const creds = await resolveEphemeralGitCredential(stackId, deploymentId)
    expect(creds.cloneUrl).toBe("https://github.com/my-org/my-repo.git")
  })

  it("throws DEPLOYMENT_NOT_FOUND when deployment does not exist", async () => {
    mockPrisma.applicationDeployment.findFirst.mockResolvedValue(null)

    expect(
      resolveEphemeralGitCredential(stackId, deploymentId)
    ).rejects.toThrow(EphemeralGitTokenError)

    try {
      await resolveEphemeralGitCredential(stackId, deploymentId)
    } catch (error) {
      expect((error as EphemeralGitTokenError).code).toBe(
        "DEPLOYMENT_NOT_FOUND"
      )
    }
  })

  it("throws INVALID_STATE when deployment is not in BUILDING status", async () => {
    const nonBuildingStatuses = [
      "IDLE",
      "QUEUED",
      "DEPLOYING",
      "RUNNING",
      "FAILED",
    ]

    for (const status of nonBuildingStatuses) {
      mockPrisma.applicationDeployment.findFirst.mockResolvedValue({
        ...validDeploymentRecord,
        status,
      })

      try {
        await resolveEphemeralGitCredential(stackId, deploymentId)
        expect.unreachable(`Should have thrown for status ${status}`)
      } catch (error) {
        expect((error as EphemeralGitTokenError).code).toBe("INVALID_STATE")
      }
    }
  })

  it("throws NO_REPOSITORY_CONNECTION when stack has no repository connection", async () => {
    mockPrisma.applicationDeployment.findFirst.mockResolvedValue({
      ...validDeploymentRecord,
      stack: {
        id: stackId,
        repositoryConnection: null,
      },
    })

    try {
      await resolveEphemeralGitCredential(stackId, deploymentId)
      expect.unreachable("Should have thrown")
    } catch (error) {
      expect((error as EphemeralGitTokenError).code).toBe(
        "NO_REPOSITORY_CONNECTION"
      )
    }
  })

  it("throws INVALID_INSTALLATION when installation or installationId is missing", async () => {
    mockPrisma.applicationDeployment.findFirst.mockResolvedValue({
      ...validDeploymentRecord,
      stack: {
        id: stackId,
        repositoryConnection: {
          ...validDeploymentRecord.stack.repositoryConnection,
          installation: null,
        },
      },
    })

    try {
      await resolveEphemeralGitCredential(stackId, deploymentId)
      expect.unreachable("Should have thrown")
    } catch (error) {
      expect((error as EphemeralGitTokenError).code).toBe(
        "INVALID_INSTALLATION"
      )
    }
  })
})
