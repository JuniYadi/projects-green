import { createSign } from "node:crypto"

import type {
  GithubActorContext,
  GithubInstallationRecord,
  GithubRepositoryListItem,
  GithubRepositoryListQuery,
  GithubRepositoryListResult,
  GithubRepositoryService,
} from "@/modules/github/github.types"

const GITHUB_API_BASE_URL = "https://api.github.com"
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

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

type GithubAppAccessTokenResponse = {
  token?: string
}

type GithubInstallationRepositoriesResponse = {
  repositories?: GithubApiRepository[]
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

    return {
      offset,
    }
  } catch {
    throw new GithubCursorError()
  }
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

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  return fromBase64UrlJson(trimmed).offset
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

  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return left.fullName.localeCompare(right.fullName)
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
  const ownerFilter = normalizeOwnerFilter(query.ownerId)
  const searchFilter = normalizeQueryFilter(query.query)

  return repositories.filter((repository) => {
    if (ownerFilter) {
      const ownerMatch =
        repository.owner.toLowerCase() === ownerFilter ||
        String(repository.installationId) === ownerFilter

      if (!ownerMatch) {
        return false
      }
    }

    if (!searchFilter) {
      return true
    }

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

const getGithubAppId = () => {
  const appId = process.env.GITHUB_APP_ID?.trim()

  if (!appId) {
    throw new GithubConfigurationError("Missing GITHUB_APP_ID.")
  }

  return appId
}

const getGithubAppPrivateKeyPem = () => {
  const base64PrivateKey = process.env.GITHUB_APP_PRIVATE_KEY_BASE64?.trim()

  if (!base64PrivateKey) {
    throw new GithubConfigurationError(
      "Missing GITHUB_APP_PRIVATE_KEY_BASE64."
    )
  }

  try {
    return Buffer.from(base64PrivateKey, "base64").toString("utf8")
  } catch {
    throw new GithubConfigurationError(
      "Invalid GITHUB_APP_PRIVATE_KEY_BASE64 value."
    )
  }
}

const createGithubAppJwt = () => {
  const appId = getGithubAppId()
  const privateKey = getGithubAppPrivateKeyPem()

  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: "RS256",
    typ: "JWT",
  }
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  }

  const encodedHeader = Buffer.from(JSON.stringify(header), "utf8").toString(
    "base64url"
  )
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  )

  const input = `${encodedHeader}.${encodedPayload}`
  const signature = createSign("RSA-SHA256").update(input).sign(privateKey)
  const encodedSignature = signature.toString("base64url")

  return `${input}.${encodedSignature}`
}

const fetchJson = async <T>(
  url: string,
  init: RequestInit,
  errorPrefix: string
): Promise<{ body: T; response: Response }> => {
  const response = await fetch(url, init)

  if (!response.ok) {
    throw new GithubApiError(
      `${errorPrefix} GitHub API returned ${response.status}.`
    )
  }

  const body = (await response.json()) as T
  return { body, response }
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
    const jwt = createGithubAppJwt()

    const { body } = await fetchJson<GithubAppAccessTokenResponse>(
      `${GITHUB_API_BASE_URL}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      "Unable to create installation access token."
    )

    if (!body.token) {
      throw new GithubApiError("GitHub did not return an access token.")
    }

    return body.token
  },
  async listRepositoriesForInstallation(installation, token) {
    const repositories: GithubRepositoryListItem[] = []
    let nextUrl: string | null =
      `${GITHUB_API_BASE_URL}/installation/repositories?per_page=100`

    while (nextUrl) {
      const { body, response } =
        await fetchJson<GithubInstallationRepositoriesResponse>(
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

    const repositoriesByInstallation = await Promise.all(
      installations.map(async (installation) => {
        const token = await dependencies.createInstallationAccessToken(
          installation.githubInstallationId
        )

        return dependencies.listRepositoriesForInstallation(installation, token)
      })
    )

    const repositories = dedupeRepositories(repositoriesByInstallation.flat())
      .sort(comparePushedAtDesc)
      .filter((repository) => {
        const ownerFilter = normalizeOwnerFilter(query.ownerId)

        if (!ownerFilter) {
          return true
        }

        const matchesOwner = repository.owner.toLowerCase() === ownerFilter
        if (matchesOwner) {
          return true
        }

        const matchesInstallation = installations.some((installation) => {
          return (
            installation.githubInstallationId === repository.installationId &&
            (installation.accountLogin.toLowerCase() === ownerFilter ||
              String(installation.targetId ?? "") === ownerFilter)
          )
        })

        return matchesInstallation
      })

    const filtered = filterRepositories(repositories, {
      ...query,
      ownerId: undefined,
    })

    return paginateRepositories(filtered, query)
  },
})

export const githubRepositoryService = createGithubRepositoryService()
