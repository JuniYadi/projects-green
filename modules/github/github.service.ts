import { createPrivateKey, sign } from "node:crypto"

import {
  FEATURE_FLAG_KEYS,
  isFeatureEnabled,
  type FeatureFlagName,
} from "@/lib/feature-flags"
import type {
  GithubAppInstallation,
  GithubInstallationRepositoriesResponse,
  GithubInstallationRepository,
} from "@/modules/github/github.types"

const GITHUB_API_BASE_URL = "https://api.github.com"

export class GithubIntegrationDisabledError extends Error {
  constructor() {
    super("GitHub App integration is disabled.")
    this.name = "GithubIntegrationDisabledError"
  }
}

export type GithubFeatureStatus = {
  feature: FeatureFlagName
  envKey: string
  enabled: boolean
}

export type GithubService = {
  getFeatureStatus: () => GithubFeatureStatus
  assertEnabled: () => void
}

export const createGithubService = (): GithubService => {
  const feature: FeatureFlagName = "github_app_integration"

  return {
    getFeatureStatus() {
      return {
        feature,
        envKey: FEATURE_FLAG_KEYS[feature],
        enabled: isFeatureEnabled(feature),
      }
    },
    assertEnabled() {
      if (!isFeatureEnabled(feature)) {
        throw new GithubIntegrationDisabledError()
      }
    },
  }
}

export const githubService = createGithubService()

type GithubInstallationStore = {
  upsert: (args: {
    where: {
      githubInstallationId: bigint
    }
    create: {
      githubInstallationId: bigint
      accountLogin: string
      accountType: string
      targetType: string
      targetId: bigint | null
      workosUserId: string
      organizationId: string | null
      status: string
      permissionsJson: Record<string, string> | null
      eventsSubscribed: string[] | null
    }
    update: {
      accountLogin: string
      accountType: string
      targetType: string
      targetId: bigint | null
      workosUserId: string
      organizationId: string | null
      status: string
      permissionsJson: Record<string, string> | null
      eventsSubscribed: string[] | null
    }
  }) => Promise<{ id: string }>
}

type GithubRepositoryConnectionStore = {
  upsert: (args: {
    where: {
      githubRepositoryId_installationId: {
        githubRepositoryId: bigint
        installationId: string
      }
    }
    create: {
      githubRepositoryId: bigint
      installationId: string
      fullName: string
      ownerLogin: string
      repoName: string
      defaultBranch: string | null
      isPrivate: boolean
      lastSyncedAt: Date
    }
    update: {
      fullName: string
      ownerLogin: string
      repoName: string
      defaultBranch: string | null
      isPrivate: boolean
      lastSyncedAt: Date
    }
  }) => Promise<unknown>
  deleteMany: (args: {
    where: {
      installationId: string
      githubRepositoryId?: {
        notIn: bigint[]
      }
    }
  }) => Promise<unknown>
}

type GithubPrismaTx = {
  githubInstallation: GithubInstallationStore
  githubRepositoryConnection: GithubRepositoryConnectionStore
}

type GithubPrismaClient = {
  $transaction: <T>(callback: (tx: GithubPrismaTx) => Promise<T>) => Promise<T>
}

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing ${name} environment variable`)
  }

  return value
}

const toBase64Url = (input: string | Buffer) => {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

const createGithubAppJwt = ({
  appId,
  privateKeyPem,
  now = new Date(),
}: {
  appId: string
  privateKeyPem: string
  now?: Date
}) => {
  const issuedAt = Math.floor(now.getTime() / 1000)
  const expiresAt = issuedAt + 9 * 60
  const header = {
    alg: "RS256",
    typ: "JWT",
  }
  const payload = {
    iat: issuedAt,
    exp: expiresAt,
    iss: appId,
  }

  const encodedHeader = toBase64Url(JSON.stringify(header))
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  const key = createPrivateKey(privateKeyPem)
  const signature = sign("RSA-SHA256", Buffer.from(unsignedToken), key)

  return `${unsignedToken}.${toBase64Url(signature)}`
}

const getGithubAppAuth = () => {
  const appId = getRequiredEnv("GITHUB_APP_ID")
  const privateKeyBase64 = getRequiredEnv("GITHUB_APP_PRIVATE_KEY_BASE64")
  const privateKeyPem = Buffer.from(privateKeyBase64, "base64").toString("utf8")

  return {
    appId,
    privateKeyPem,
  }
}

const githubRequest = async <T>({
  path,
  method = "GET",
  token,
  body,
}: {
  path: string
  method?: "GET" | "POST"
  token: string
  body?: unknown
}) => {
  const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(
      `GitHub API request failed: ${method} ${path} (${response.status}) ${responseText}`
    )
  }

  return (await response.json()) as T
}

export const getGithubInstallUrl = ({ state }: { state: string }) => {
  const appSlug = getRequiredEnv("GITHUB_APP_SLUG")
  const callbackUrl =
    process.env.GITHUB_APP_INSTALL_REDIRECT_URI?.trim() || undefined

  const installUrl = new URL(
    `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`
  )
  installUrl.searchParams.set("state", state)

  if (callbackUrl) {
    installUrl.searchParams.set("redirect_uri", callbackUrl)
  }

  return installUrl.toString()
}

const createInstallationToken = async (installationId: bigint) => {
  const { appId, privateKeyPem } = getGithubAppAuth()
  const appJwt = createGithubAppJwt({
    appId,
    privateKeyPem,
  })

  const result = await githubRequest<{
    token: string
  }>({
    path: `/app/installations/${installationId}/access_tokens`,
    method: "POST",
    token: appJwt,
  })

  return result.token
}

export const fetchGithubInstallationDetails = async (
  installationId: bigint
): Promise<GithubAppInstallation> => {
  const { appId, privateKeyPem } = getGithubAppAuth()
  const appJwt = createGithubAppJwt({
    appId,
    privateKeyPem,
  })

  return githubRequest<GithubAppInstallation>({
    path: `/app/installations/${installationId}`,
    token: appJwt,
  })
}

export const fetchGithubInstallationRepositories = async (
  installationId: bigint
): Promise<GithubInstallationRepository[]> => {
  const installationToken = await createInstallationToken(installationId)

  const response = await githubRequest<GithubInstallationRepositoriesResponse>({
    path: "/installation/repositories",
    token: installationToken,
  })

  return response.repositories
}

export const syncGithubInstallation = async ({
  installationId,
  workosUserId,
  organizationId,
  installation,
  repositories,
  prismaClient,
}: {
  installationId: bigint
  workosUserId: string
  organizationId: string | null
  installation: GithubAppInstallation
  repositories: GithubInstallationRepository[]
  prismaClient?: GithubPrismaClient
}) => {
  const dbClient =
    prismaClient ??
    ((await import("@/lib/prisma")).prisma as unknown as GithubPrismaClient)

  return dbClient.$transaction(async (tx) => {
    const installationRecord = await tx.githubInstallation.upsert({
      where: {
        githubInstallationId: installationId,
      },
      create: {
        githubInstallationId: installationId,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        targetType: installation.target_type,
        targetId:
          installation.target_id === null ? null : BigInt(installation.target_id),
        workosUserId,
        organizationId,
        status: "active",
        permissionsJson: installation.permissions,
        eventsSubscribed: installation.events,
      },
      update: {
        accountLogin: installation.account.login,
        accountType: installation.account.type,
        targetType: installation.target_type,
        targetId:
          installation.target_id === null ? null : BigInt(installation.target_id),
        workosUserId,
        organizationId,
        status: "active",
        permissionsJson: installation.permissions,
        eventsSubscribed: installation.events,
      },
    })

    const syncedAt = new Date()
    const repoIds: bigint[] = []

    for (const repo of repositories) {
      const githubRepositoryId = BigInt(repo.id)
      repoIds.push(githubRepositoryId)

      await tx.githubRepositoryConnection.upsert({
        where: {
          githubRepositoryId_installationId: {
            githubRepositoryId,
            installationId: installationRecord.id,
          },
        },
        create: {
          githubRepositoryId,
          installationId: installationRecord.id,
          fullName: repo.full_name,
          ownerLogin: repo.owner.login,
          repoName: repo.name,
          defaultBranch: repo.default_branch,
          isPrivate: repo.private,
          lastSyncedAt: syncedAt,
        },
        update: {
          fullName: repo.full_name,
          ownerLogin: repo.owner.login,
          repoName: repo.name,
          defaultBranch: repo.default_branch,
          isPrivate: repo.private,
          lastSyncedAt: syncedAt,
        },
      })
    }

    if (repoIds.length > 0) {
      await tx.githubRepositoryConnection.deleteMany({
        where: {
          installationId: installationRecord.id,
          githubRepositoryId: {
            notIn: repoIds,
          },
        },
      })
    } else {
      await tx.githubRepositoryConnection.deleteMany({
        where: {
          installationId: installationRecord.id,
        },
      })
    }

    return installationRecord
  })
}
