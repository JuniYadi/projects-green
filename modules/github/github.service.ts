import { createHash, createPrivateKey, sign } from "node:crypto"

import { redis } from "@/lib/redis"
import {
  decrypt,
  encrypt,
  parseEncryptedField,
  serializeEncryptedField,
} from "@/lib/encryption"
import {
  FEATURE_FLAG_KEYS,
  isFeatureEnabled,
  type FeatureFlagName,
} from "@/lib/feature-flags"
import type {
  GithubActorContext,
  GithubAppInstallation,
  GithubInstallationRecord,
  GithubInstallationRepositoriesResponse,
  GithubInstallationRepository,
  GithubRepositoryListItem,
  GithubRepositoryListQuery,
  GithubRepositoryListResult,
  GithubRepositoryService,
} from "@/modules/github/github.types"

const GITHUB_API_BASE_URL = "https://api.github.com"
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const TOKEN_CACHE_TTL_SECONDS = 55 * 60 // 55 minutes

export class GithubIntegrationDisabledError extends Error {
  constructor() {
    super("GitHub App integration is disabled.")
    this.name = "GithubIntegrationDisabledError"
  }
}

export class GithubCursorError extends Error {
  constructor() {
    super("Invalid cursor value.")
    this.name = "GithubCursorError"
  }
}

export class GithubConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GithubConfigurationError"
  }
}

export class GithubApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GithubApiError"
  }
}

export type GithubFeatureStatus = {
  feature: FeatureFlagName
  envKey: string
  enabled: boolean
}

export type GithubService = GithubRepositoryService & {
  getFeatureStatus: () => GithubFeatureStatus
  assertEnabled: () => void
}

type GithubDependencies = {
  listActiveInstallations: (
    actor: GithubActorContext
  ) => Promise<GithubInstallationRecord[]>
  createInstallationAccessToken: (installationId: number) => Promise<string>
  listRepositoriesForInstallation: (
    installation: GithubInstallationRecord,
    token: string
  ) => Promise<GithubRepositoryListItem[]>
}

type CursorPayload = {
  offset: number
}

type GithubApiRepository = {
  id: number
  full_name: string
  name: string
  private: boolean
  default_branch: string | null
  pushed_at: string | null
  owner?: {
    login?: string
  }
}

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
    throw new GithubConfigurationError(`Missing ${name} environment variable`)
  }

  return value
}

const getEncryptionKey = () => {
  const secret = getRequiredEnv("APP_SECRET")
  return createHash("sha256").update(secret).digest()
}

const toBase64Url = (input: string | Buffer) => {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

const toBase64UrlJson = (payload: CursorPayload) => {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

const fromBase64UrlJson = (cursor: string): CursorPayload => {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8")
    const parsed = JSON.parse(decoded) as { offset?: unknown }
    const offset = parsed.offset

    if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0) {
      throw new Error("Invalid offset")
    }

    return { offset }
  } catch {
    throw new GithubCursorError()
  }
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

const fetchJson = async <T>(
  url: string,
  init: RequestInit,
  errorPrefix: string
): Promise<{ body: T; response: Response }> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new GithubApiError(
        `${errorPrefix} GitHub API returned ${response.status}.`
      )
    }

    const body = (await response.json()) as T

    return { body, response }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === "AbortError") {
      throw new GithubApiError(`${errorPrefix} Request timed out.`)
    }

    throw error
  }
}

const parseLinkHeader = (headerValue: string | null) => {
  if (!headerValue) {
    return null
  }

  const links = headerValue.split(",").map((part) => part.trim())
  const nextLink = links.find((part) => part.includes('rel="next"'))

  if (!nextLink) {
    return null
  }

  const match = nextLink.match(/<([^>]+)>/)
  return match?.[1] ?? null
}

const toInstallationId = (value: number | bigint | string) => {
  const numericValue =
    typeof value === "bigint" ? Number(value) : Number(String(value))

  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new GithubApiError("Invalid GitHub installation id.")
  }

  return numericValue
}

const normalizeLimit = (value: number | undefined) => {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return DEFAULT_LIMIT
  }

  return Math.min(Math.floor(value), MAX_LIMIT)
}

const resolveOffset = (cursor: string | undefined) => {
  if (!cursor) {
    return 0
  }

  const trimmed = cursor.trim()

  if (!trimmed) {
    return 0
  }

  try {
    return fromBase64UrlJson(trimmed).offset
  } catch {
    return 0
  }
}

const normalizeOwnerFilter = (value: string | undefined) => {
  return value?.trim().toLowerCase() ?? ""
}

const normalizeQueryFilter = (value: string | undefined) => {
  return value?.trim().toLowerCase() ?? ""
}

const comparePushedAtDesc = (
  left: GithubRepositoryListItem,
  right: GithubRepositoryListItem
) => {
  if (!left.pushedAt && !right.pushedAt) {
    return left.fullName.localeCompare(right.fullName)
  }

  if (!left.pushedAt) {
    return 1
  }

  if (!right.pushedAt) {
    return -1
  }

  const leftTime = Date.parse(left.pushedAt)
  const rightTime = Date.parse(right.pushedAt)

  const leftIsNaN = Number.isNaN(leftTime)
  const rightIsNaN = Number.isNaN(rightTime)

  if (leftIsNaN && rightIsNaN) {
    return left.fullName.localeCompare(right.fullName)
  }

  if (leftIsNaN) {
    return 1
  }

  if (rightIsNaN) {
    return -1
  }

  if (leftTime === rightTime) {
    return left.fullName.localeCompare(right.fullName)
  }

  return rightTime - leftTime
}

const filterRepositories = (
  repositories: GithubRepositoryListItem[],
  query: GithubRepositoryListQuery
) => {
  const searchFilter = normalizeQueryFilter(query.query)

  if (!searchFilter) {
    return repositories
  }

  return repositories.filter((repository) => {
    const haystacks = [
      repository.fullName,
      repository.name,
      repository.owner,
    ].map((value) => value.toLowerCase())

    return haystacks.some((value) => value.includes(searchFilter))
  })
}

const paginateRepositories = (
  repositories: GithubRepositoryListItem[],
  query: GithubRepositoryListQuery
): GithubRepositoryListResult => {
  const limit = normalizeLimit(query.limit)
  const offset = resolveOffset(query.cursor)
  const start = Math.max(0, offset)
  const end = start + limit
  const items = repositories.slice(start, end)

  return {
    items,
    nextCursor:
      end < repositories.length ? toBase64UrlJson({ offset: end }) : null,
  }
}

const dedupeRepositories = (repositories: GithubRepositoryListItem[]) => {
  const deduped = new Map<number, GithubRepositoryListItem>()

  for (const repository of repositories) {
    if (!deduped.has(repository.repositoryId)) {
      deduped.set(repository.repositoryId, repository)
    }
  }

  return Array.from(deduped.values())
}

const createInstallationToken = async (installationId: bigint | number) => {
  const cacheKey = `github:iat:${installationId}`

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      const encryptedData = parseEncryptedField(cached)
      if (encryptedData) {
        const decrypted = decrypt(encryptedData, getEncryptionKey())
        if (decrypted && decrypted.trim()) {
          return decrypted
        }
      }
    }
  } catch (error) {
    console.error("Failed to retrieve GitHub token from cache", error)
  }

  const { appId, privateKeyPem } = getGithubAppAuth()
  const appJwt = createGithubAppJwt({
    appId,
    privateKeyPem,
  })

  const result = await githubRequest<{ token: string }>({
    path: `/app/installations/${installationId}/access_tokens`,
    method: "POST",
    token: appJwt,
  })

  try {
    const encrypted = encrypt(result.token, getEncryptionKey())
    // Token caching is best-effort to optimize performance.
    // If it fails, the service will still return the newly generated token.
    await redis.set(
      cacheKey,
      serializeEncryptedField(encrypted),
      "EX",
      TOKEN_CACHE_TTL_SECONDS
    )
  } catch (error) {
    console.error("Failed to cache GitHub token", error)
  }

  return result.token
}

const createDefaultDependencies = (): GithubDependencies => ({
  async listActiveInstallations(actor) {
    const { prisma } = await import("@/lib/prisma")

    const installations = await prisma.githubInstallation.findMany({
      where: {
        status: "active",
        OR: [
          {
            workosUserId: actor.userId,
          },
          ...(actor.organizationId
            ? [
                {
                  organizationId: actor.organizationId,
                },
              ]
            : []),
        ],
      },
      select: {
        githubInstallationId: true,
        accountLogin: true,
        targetId: true,
      },
      orderBy: {
        installedAt: "desc",
      },
    })

    return installations.map((installation) => ({
      githubInstallationId: toInstallationId(installation.githubInstallationId),
      accountLogin: installation.accountLogin,
      targetId:
        installation.targetId === null ? null : Number(installation.targetId),
    }))
  },
  async createInstallationAccessToken(installationId) {
    try {
      return await createInstallationToken(installationId)
    } catch (error) {
      if (error instanceof GithubConfigurationError) {
        throw error
      }
      throw new GithubApiError("Unable to create installation access token.")
    }
  },
  async listRepositoriesForInstallation(installation, token) {
    const repositories: GithubRepositoryListItem[] = []
    let nextUrl: string | null =
      `${GITHUB_API_BASE_URL}/installation/repositories?per_page=100`

    while (nextUrl) {
      const { body, response } = await fetchJson<{
        repositories?: GithubApiRepository[]
      }>(
        nextUrl,
        {
          method: "GET",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
        "Unable to list installation repositories."
      )

      const currentPage = body.repositories ?? []

      repositories.push(
        ...currentPage.map((repository) => ({
          repositoryId: repository.id,
          fullName: repository.full_name,
          name: repository.name,
          owner: repository.owner?.login ?? installation.accountLogin,
          installationId: installation.githubInstallationId,
          defaultBranch: repository.default_branch,
          private: repository.private,
          pushedAt: repository.pushed_at,
        }))
      )

      nextUrl = parseLinkHeader(response.headers.get("link"))
    }

    return repositories
  },
})

export const createGithubRepositoryService = (
  dependencies: GithubDependencies = createDefaultDependencies()
): GithubRepositoryService => ({
  async listRepositoriesForActor(actor, query) {
    const installations = await dependencies.listActiveInstallations(actor)

    if (!installations.length) {
      return {
        items: [],
        nextCursor: null,
      }
    }

    const ownerFilter = normalizeOwnerFilter(query.ownerId)
    const targetInstallations = ownerFilter
      ? installations.filter(
          (inst) =>
            inst.accountLogin.toLowerCase() === ownerFilter ||
            String(inst.targetId ?? "") === ownerFilter ||
            String(inst.githubInstallationId) === ownerFilter
        )
      : installations

    if (!targetInstallations.length) {
      return {
        items: [],
        nextCursor: null,
      }
    }

    const repositoriesByInstallation = await Promise.all(
      targetInstallations.map(async (installation) => {
        const token = await dependencies.createInstallationAccessToken(
          installation.githubInstallationId
        )

        return dependencies.listRepositoriesForInstallation(installation, token)
      })
    )

    const repositories = dedupeRepositories(repositoriesByInstallation.flat())
      .sort(comparePushedAtDesc)

    const filtered = filterRepositories(repositories, query)

    return paginateRepositories(filtered, query)
  },
})

export const githubRepositoryService = createGithubRepositoryService()

export const createGithubService = (
  repositoryService: GithubRepositoryService = githubRepositoryService
): GithubService => {
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
    async listRepositoriesForActor(actor, query) {
      return repositoryService.listRepositoriesForActor(actor, query)
    },
  }
}

export const githubService = createGithubService()

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
          installation.target_id === null
            ? null
            : BigInt(installation.target_id),
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
          installation.target_id === null
            ? null
            : BigInt(installation.target_id),
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

// --- Repository Inspection Tools for AI Detector ---

export type GithubRepoTreeItem = {
  path: string
  mode: string
  type: string // "blob" or "tree"
  sha: string
  size?: number
  url: string
}

export type GithubRepoContent = {
  name: string
  path: string
  content: string // Base64-encoded content
  encoding: string // "base64"
  sha: string
  size: number
  url: string
}

export type ListRepoFilesInput = {
  installationId: number
  owner: string
  repo: string
  ref?: string // branch, tag, or commit SHA (defaults to default branch)
  path?: string // subdirectory to list (recursive from this path)
}

export type ReadRepoFileInput = {
  installationId: number
  owner: string
  repo: string
  filePath: string
  ref?: string // branch, tag, or commit SHA
}

/**
 * List all files in a repository using the GitHub Trees API.
 * Returns a flat list of file paths relative to the repo root.
 */
export const listRepoFiles = async (
  input: ListRepoFilesInput
): Promise<{ files: string[]; truncated: boolean }> => {
  const token = await createInstallationToken(input.installationId)
  const ref = input.ref ?? "HEAD"

  // First, get the tree SHA for the ref
  let treeSha: string | undefined

  try {
    const refData = await githubRequest<{
      object?: { sha?: string; type?: string }
    }>({
      path: `/repos/${input.owner}/${input.repo}/git/ref/heads/${ref}`,
      token,
    })
    treeSha = refData.object?.sha
  } catch {
    // Fallback: try as a direct SHA or tag
    try {
      const commitData = await githubRequest<{ sha?: string }>({
        path: `/repos/${input.owner}/${input.repo}/git/commits/${ref}`,
        token,
      })
      treeSha = commitData.sha
    } catch {
      // Fall through to error below
    }
  }

  if (!treeSha) {
    throw new GithubApiError(
      `Unable to resolve ref "${ref}" for ${input.owner}/${input.repo}.`
    )
  }

  // Get the recursive tree
  const treeData = await githubRequest<{ tree?: GithubRepoTreeItem[]; truncated?: boolean }>({
    path: `/repos/${input.owner}/${input.repo}/git/trees/${treeSha}?recursive=1`,
    token,
  })

  const allItems = treeData.tree ?? []
  const prefix = input.path ? `${input.path.replace(/\/$/, "")}/` : ""

  const files = allItems
    .filter((item) => item.type === "blob")
    .map((item) => item.path)
    .filter((filePath) => {
      if (!prefix) return true
      return filePath.startsWith(prefix)
    })
    .map((filePath) => (prefix ? filePath.slice(prefix.length) : filePath))
    .filter((filePath) => !filePath.startsWith("../") && filePath.length > 0)

  return {
    files,
    truncated: treeData.truncated ?? false,
  }
}

/**
 * Read a single file from a repository using the GitHub Contents API.
 * Returns the decoded file content.
 */
export const readRepoFile = async (
  input: ReadRepoFileInput
): Promise<{ content: string; path: string; sha: string; size: number }> => {
  const token = await createInstallationToken(input.installationId)
  const ref = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : ""

  const data = await githubRequest<GithubRepoContent>({
    path: `/repos/${input.owner}/${input.repo}/contents/${input.filePath}${ref}`,
    token,
  })

  if (data.encoding !== "base64") {
    throw new GithubApiError(
      `Unexpected encoding "${data.encoding}" for file "${input.filePath}".`
    )
  }

  // GitHub Contents API has a 1MB limit for file content
  const MAX_CONTENT_SIZE = 1_000_000 // 1MB in bytes
  if (data.size > MAX_CONTENT_SIZE) {
    return {
      content: `// File too large to read (${data.size} bytes) — truncated`,
      path: data.path,
      sha: data.sha,
      size: data.size,
    }
  }

  const content = Buffer.from(data.content, "base64").toString("utf8")

  return {
    content,
    path: data.path,
    sha: data.sha,
    size: data.size,
  }
}
