import type { PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { AiDeploymentSessionActor } from "@/modules/deploy/ai-deployment-session.service"
import { createInstallationToken } from "@/modules/github/github.service"
import type {
  GitProviderAccessResult,
  GitProviderAdapter,
} from "./git-provider.interface"

export type ParsedGithubUrl = {
  owner: string
  repo: string
}

export function parseGithubUrl(rawUrl: string): ParsedGithubUrl | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  // SSH style: git@github.com:owner/repo(.git)?
  const sshMatch = trimmed.match(
    /^git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?$/i
  )
  if (sshMatch) {
    const owner = sshMatch[1]
    const repo = sshMatch[2].replace(/\.git$/i, "")
    if (!owner || !repo) return null
    return { owner, repo }
  }

  let urlWithScheme = trimmed
  if (!/^[a-zA-Z]+:\/\//.test(trimmed)) {
    urlWithScheme = `https://${trimmed}`
  }

  try {
    const parsed = new URL(urlWithScheme)
    if (parsed.hostname.toLowerCase() !== "github.com") {
      return null
    }

    const segments = parsed.pathname.split("/").filter((s) => s.length > 0)

    if (segments.length < 2) {
      return null
    }

    const owner = segments[0]
    const repo = segments[1].replace(/\.git$/i, "")
    if (!owner || !repo) {
      return null
    }

    return { owner, repo }
  } catch {
    return null
  }
}

export type GitHubProviderAdapterDependencies = {
  fetchFn?: typeof fetch
  db?: PrismaClient
  getInstallationToken?: (installationId: number) => Promise<string>
}

export class GitHubProviderAdapter implements GitProviderAdapter {
  readonly name = "github"
  private readonly fetchFn: typeof fetch
  private readonly db: PrismaClient
  private readonly getInstallationToken: (
    installationId: number
  ) => Promise<string>

  constructor(dependencies: GitHubProviderAdapterDependencies = {}) {
    this.fetchFn = dependencies.fetchFn ?? globalThis.fetch
    this.db = dependencies.db ?? prisma
    this.getInstallationToken =
      dependencies.getInstallationToken ??
      (async (id: number) => createInstallationToken(id))
  }

  matches(url: string): boolean {
    return parseGithubUrl(url) !== null
  }

  async checkAccess(
    url: string,
    actor?: AiDeploymentSessionActor
  ): Promise<GitProviderAccessResult> {
    const parsed = parseGithubUrl(url)
    if (!parsed) {
      return {
        accessible: false,
        reason: "Invalid GitHub repository URL",
        provider: "github",
      }
    }

    const { owner, repo } = parsed
    const token = await this.resolveToken(owner, repo, actor)

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Antigravity-GitProvider",
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    try {
      const response = await this.fetchFn(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers }
      )

      if (response.status === 200) {
        const data = (await response.json()) as {
          private?: boolean
          default_branch?: string
        }
        return {
          accessible: true,
          provider: "github",
          isPrivate: Boolean(data.private),
          defaultBranch: data.default_branch ?? "main",
        }
      }

      if (response.status === 404) {
        if (!token) {
          return {
            accessible: false,
            requiresAuth: true,
            isPrivate: true,
            reason:
              "Repository is private or not found; GitHub authorization required",
            provider: "github",
          }
        }
        return {
          accessible: false,
          requiresAuth: true,
          isPrivate: true,
          reason:
            "Repository not found or access not granted to GitHub App installation",
          provider: "github",
        }
      }

      if (response.status === 401) {
        return {
          accessible: false,
          requiresAuth: true,
          reason: "GitHub authentication required or token invalid",
          provider: "github",
        }
      }

      if (response.status === 403) {
        return {
          accessible: false,
          reason: "GitHub API rate limit exceeded or access forbidden",
          provider: "github",
        }
      }

      return {
        accessible: false,
        reason: `GitHub API error (${response.status})`,
        provider: "github",
      }
    } catch (error) {
      return {
        accessible: false,
        reason:
          error instanceof Error
            ? error.message
            : "Network error contacting GitHub",
        provider: "github",
      }
    }
  }

  async listTree(
    url: string,
    ref?: string,
    subpath?: string,
    actor?: AiDeploymentSessionActor
  ): Promise<{ files: string[]; truncated: boolean }> {
    const parsed = parseGithubUrl(url)
    if (!parsed) {
      throw new Error("Invalid GitHub repository URL")
    }

    const { owner, repo } = parsed
    const token = await this.resolveToken(owner, repo, actor)

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Antigravity-GitProvider",
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    let targetRef = ref?.trim()
    if (!targetRef) {
      // Resolve default branch
      const repoRes = await this.fetchFn(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers }
      )
      if (repoRes.status === 200) {
        const repoData = (await repoRes.json()) as { default_branch?: string }
        targetRef = repoData.default_branch ?? "main"
      } else {
        targetRef = "main"
      }
    }

    // Try fetching tree
    let treeRes = await this.fetchFn(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(targetRef)}?recursive=1`,
      { headers }
    )

    if (treeRes.status === 404) {
      // Fallback: try resolving commit SHA
      const commitRes = await this.fetchFn(
        `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(targetRef)}`,
        { headers }
      )
      if (commitRes.status === 200) {
        const commitData = (await commitRes.json()) as {
          sha?: string
          commit?: { tree?: { sha?: string } }
        }
        const treeSha = commitData.commit?.tree?.sha ?? commitData.sha
        if (treeSha) {
          treeRes = await this.fetchFn(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
            { headers }
          )
        }
      }
    }

    if (treeRes.status !== 200) {
      throw new Error(`Failed to list tree from GitHub (${treeRes.status})`)
    }

    const treeData = (await treeRes.json()) as {
      tree?: Array<{ path: string; type: string }>
      truncated?: boolean
    }

    const allItems = treeData.tree ?? []
    const prefix = subpath ? `${subpath.replace(/^\/+|\/+$/g, "")}/` : ""

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
      truncated: Boolean(treeData.truncated),
    }
  }

  async readFile(
    url: string,
    filePath: string,
    ref?: string,
    actor?: AiDeploymentSessionActor
  ): Promise<{ content: string; size: number }> {
    const parsed = parseGithubUrl(url)
    if (!parsed) {
      throw new Error("Invalid GitHub repository URL")
    }

    const { owner, repo } = parsed
    const token = await this.resolveToken(owner, repo, actor)

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Antigravity-GitProvider",
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const cleanFilePath = filePath.replace(/^\/+/, "")
    const encodedPath = cleanFilePath
      .split("/")
      .map(encodeURIComponent)
      .join("/")
    const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : ""
    const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}${refQuery}`

    const response = await this.fetchFn(contentsUrl, { headers })

    if (response.status === 404) {
      throw new Error(`File not found: ${filePath}`)
    }

    if (response.status !== 200) {
      throw new Error(
        `GitHub API error (${response.status}) while reading ${filePath}`
      )
    }

    const data = (await response.json()) as {
      content?: string
      encoding?: string
      size?: number
    }

    if (data.encoding === "base64" && typeof data.content === "string") {
      const content = Buffer.from(
        data.content.replace(/\n/g, ""),
        "base64"
      ).toString("utf8")
      return {
        content,
        size: data.size ?? Buffer.byteLength(content, "utf8"),
      }
    }

    const rawContent =
      typeof data.content === "string" ? data.content : JSON.stringify(data)
    return {
      content: rawContent,
      size: data.size ?? Buffer.byteLength(rawContent, "utf8"),
    }
  }

  private async resolveToken(
    owner: string,
    repo: string,
    actor?: AiDeploymentSessionActor
  ): Promise<string | null> {
    if (!actor) return null

    try {
      const tenantFilter = actor.organizationId
        ? [
            { organizationId: actor.organizationId },
            { organizationId: null, workosUserId: actor.userId },
          ]
        : [{ organizationId: null, workosUserId: actor.userId }]

      const connection = await this.db.githubRepositoryConnection.findFirst({
        where: {
          fullName: {
            equals: `${owner}/${repo}`,
            mode: "insensitive",
          },
          installation: {
            status: "active",
            OR: tenantFilter,
          },
        },
        select: {
          installation: {
            select: {
              githubInstallationId: true,
            },
          },
        },
      })

      let installationId = connection?.installation.githubInstallationId

      if (!installationId) {
        const installation = await this.db.githubInstallation.findFirst({
          where: {
            accountLogin: {
              equals: owner,
              mode: "insensitive",
            },
            status: "active",
            OR: tenantFilter,
          },
          select: {
            githubInstallationId: true,
          },
        })
        installationId = installation?.githubInstallationId
      }

      if (installationId) {
        return await this.getInstallationToken(Number(installationId))
      }
    } catch {
      // Ignore lookup failure, proceed unauthenticated
    }

    return null
  }
}
