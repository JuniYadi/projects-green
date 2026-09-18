import { prisma } from "@/lib/prisma"
import { createInstallationToken } from "@/modules/github/github.service"
import type { EphemeralGitCredentialPayload } from "./ephemeral-git-token.dto"

export class EphemeralGitTokenError extends Error {
  constructor(
    public readonly code:
      | "DEPLOYMENT_NOT_FOUND"
      | "INVALID_STATE"
      | "NO_REPOSITORY_CONNECTION"
      | "INVALID_INSTALLATION",
    message: string
  ) {
    super(message)
    this.name = "EphemeralGitTokenError"
  }
}

/**
 * Resolves an ephemeral Git credential for a building deployment.
 * Enforces that the deployment exists, belongs to the specified stack,
 * and is actively in the BUILDING lifecycle state.
 */
export async function resolveEphemeralGitCredential(
  stackId: string,
  deploymentId: string
): Promise<EphemeralGitCredentialPayload> {
  const deployment = await prisma.applicationDeployment.findFirst({
    where: {
      id: deploymentId,
      stackId,
    },
    include: {
      stack: {
        include: {
          repositoryConnection: {
            include: {
              installation: true,
            },
          },
        },
      },
    },
  })

  if (!deployment) {
    throw new EphemeralGitTokenError(
      "DEPLOYMENT_NOT_FOUND",
      `Deployment '${deploymentId}' not found for stack '${stackId}'`
    )
  }

  if (deployment.status !== "BUILDING") {
    throw new EphemeralGitTokenError(
      "INVALID_STATE",
      `Deployment '${deploymentId}' is in state '${deployment.status}', expected 'BUILDING'`
    )
  }

  const stack = deployment.stack
  const repoConnection = stack?.repositoryConnection

  if (!repoConnection) {
    throw new EphemeralGitTokenError(
      "NO_REPOSITORY_CONNECTION",
      `No repository connection found for stack '${stackId}'`
    )
  }

  if (!repoConnection.installation?.githubInstallationId) {
    throw new EphemeralGitTokenError(
      "INVALID_INSTALLATION",
      `No GitHub installation found for repository '${repoConnection.fullName}'`
    )
  }

  const token = await createInstallationToken(
    repoConnection.installation.githubInstallationId
  )

  const fullName = repoConnection.fullName
  const cloneUrl = fullName.endsWith(".git")
    ? `https://github.com/${fullName}`
    : `https://github.com/${fullName}.git`

  // 55-minute TTL aligned with Redis installation token cache
  const expiresAt = Math.floor(Date.now() / 1000) + 3300

  return {
    provider: "github",
    username: "x-access-token",
    token,
    cloneUrl,
    expiresAt,
  }
}
