import type { AiDeploymentSessionActor } from "@/modules/deploy/ai-deployment-session.service"
import type {
  GitProviderAccessResult,
  GitProviderAdapter,
} from "./git-provider.interface"

export type ParsedGitLabUrl = {
  host: string
  projectPath: string
  encodedId: string
}

export function parseGitLabUrl(
  rawUrl: string,
  allowedHosts: string[] = ["gitlab.com"]
): ParsedGitLabUrl | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null

  // SSH style: git@host:group/subgroup/project(.git)?
  const sshMatch = trimmed.match(
    /^git@([a-zA-Z0-9_.-]+):([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+?)(\.git)?$/i
  )
  if (sshMatch) {
    const host = sshMatch[1].toLowerCase()
    const isGitLabHost = allowedHosts.includes(host) || host.includes("gitlab")
    if (!isGitLabHost) return null

    const projectPath = sshMatch[2].replace(/\.git$/i, "")
    return {
      host,
      projectPath,
      encodedId: encodeURIComponent(projectPath),
    }
  }

  let urlWithScheme = trimmed
  if (!/^[a-zA-Z]+:\/\//.test(trimmed)) {
    urlWithScheme = `https://${trimmed}`
  }

  try {
    const parsed = new URL(urlWithScheme)
    const host = parsed.hostname.toLowerCase()
    const isGitLabHost = allowedHosts.includes(host) || host.includes("gitlab")
    if (!isGitLabHost) return null

    const rawPath = parsed.pathname
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.git$/i, "")
    const segments = rawPath.split("/").filter(Boolean)
    if (segments.length < 2) return null

    const projectPath = segments.join("/")
    return {
      host,
      projectPath,
      encodedId: encodeURIComponent(projectPath),
    }
  } catch {
    return null
  }
}

export type GitLabProviderAdapterDependencies = {
  fetchFn?: typeof fetch
  getToken?: (
    actor?: AiDeploymentSessionActor
  ) => Promise<string | null> | string | null
  allowedHosts?: string[]
  maxPages?: number
}

export class GitLabProviderAdapter implements GitProviderAdapter {
  readonly name = "gitlab"
  private readonly fetchFn: typeof fetch
  private readonly getToken?: (
    actor?: AiDeploymentSessionActor
  ) => Promise<string | null> | string | null
  private readonly allowedHosts: string[]
  private readonly maxPages: number

  constructor(dependencies: GitLabProviderAdapterDependencies = {}) {
    this.fetchFn = dependencies.fetchFn ?? globalThis.fetch
    this.getToken =
      dependencies.getToken ??
      (() => {
        const envToken = process.env.GITLAB_TOKEN?.trim()
        return envToken || null
      })
    this.allowedHosts = dependencies.allowedHosts ?? ["gitlab.com"]
    this.maxPages = dependencies.maxPages ?? 10
  }

  matches(url: string): boolean {
    return parseGitLabUrl(url, this.allowedHosts) !== null
  }

  async checkAccess(
    url: string,
    actor?: AiDeploymentSessionActor
  ): Promise<GitProviderAccessResult> {
    const parsed = parseGitLabUrl(url, this.allowedHosts)
    if (!parsed) {
      return {
        accessible: false,
        reason: "Invalid GitLab repository URL",
        provider: "gitlab",
      }
    }

    const token = this.getToken ? await this.getToken(actor) : null
    const headers: Record<string, string> = {
      "User-Agent": "Antigravity-GitProvider",
    }
    if (token) {
      headers["PRIVATE-TOKEN"] = token
    }

    try {
      const response = await this.fetchFn(
        `https://${parsed.host}/api/v4/projects/${parsed.encodedId}`,
        { headers }
      )

      if (response.status === 200) {
        const data = (await response.json()) as {
          visibility?: string
          default_branch?: string
        }
        return {
          accessible: true,
          provider: "gitlab",
          isPrivate: data.visibility !== "public",
          defaultBranch: data.default_branch ?? "main",
        }
      }

      if (response.status === 404) {
        return {
          accessible: false,
          requiresAuth: true,
          isPrivate: true,
          reason: "GitLab project not found or private; authorization required",
          provider: "gitlab",
        }
      }

      if (response.status === 401) {
        return {
          accessible: false,
          requiresAuth: true,
          isPrivate: true,
          reason: "GitLab authorization required or token invalid",
          provider: "gitlab",
        }
      }

      if (response.status === 403) {
        return {
          accessible: false,
          reason: "GitLab access forbidden",
          provider: "gitlab",
        }
      }

      return {
        accessible: false,
        reason: `GitLab API error (${response.status})`,
        provider: "gitlab",
      }
    } catch (error) {
      return {
        accessible: false,
        reason:
          error instanceof Error
            ? error.message
            : "Network error contacting GitLab",
        provider: "gitlab",
      }
    }
  }

  async listTree(
    url: string,
    ref?: string,
    subpath?: string,
    actor?: AiDeploymentSessionActor
  ): Promise<{ files: string[]; truncated: boolean }> {
    const parsed = parseGitLabUrl(url, this.allowedHosts)
    if (!parsed) {
      throw new Error("Invalid GitLab repository URL")
    }

    const token = this.getToken ? await this.getToken(actor) : null
    const headers: Record<string, string> = {
      "User-Agent": "Antigravity-GitProvider",
    }
    if (token) {
      headers["PRIVATE-TOKEN"] = token
    }

    const params = new URLSearchParams({
      recursive: "true",
      per_page: "100",
    })
    if (ref?.trim()) {
      params.set("ref", ref.trim())
    }
    if (subpath?.trim()) {
      params.set("path", subpath.trim().replace(/^\/+|\/+$/g, ""))
    }

    const files: string[] = []
    let truncated = false
    let page = 1
    const prefix = subpath ? `${subpath.trim().replace(/^\/+|\/+$/g, "")}/` : ""

    while (page <= this.maxPages) {
      params.set("page", String(page))
      const treeUrl = `https://${parsed.host}/api/v4/projects/${parsed.encodedId}/repository/tree?${params.toString()}`
      const response = await this.fetchFn(treeUrl, { headers })

      if (response.status !== 200) {
        throw new Error(
          `GitLab API error (${response.status}) while listing tree`
        )
      }

      const items = (await response.json()) as Array<{
        id: string
        name: string
        type: string
        path: string
      }>

      for (const item of items) {
        if (item.type === "blob") {
          let filePath = item.path
          if (prefix && filePath.startsWith(prefix)) {
            filePath = filePath.slice(prefix.length)
          }
          if (!filePath.startsWith("../") && filePath.length > 0) {
            files.push(filePath)
          }
        }
      }

      const nextPageHeader = response.headers.get("x-next-page")
      const hasNextPage =
        nextPageHeader !== null
          ? Boolean(nextPageHeader.trim().length > 0)
          : items.length >= 100

      if (page >= this.maxPages) {
        truncated = hasNextPage
        break
      }

      if (!hasNextPage) {
        truncated = false
        break
      }

      page++
    }

    return {
      files,
      truncated,
    }
  }

  async readFile(
    url: string,
    filePath: string,
    ref?: string,
    actor?: AiDeploymentSessionActor
  ): Promise<{ content: string; size: number }> {
    const parsed = parseGitLabUrl(url, this.allowedHosts)
    if (!parsed) {
      throw new Error("Invalid GitLab repository URL")
    }

    const token = this.getToken ? await this.getToken(actor) : null
    const headers: Record<string, string> = {
      "User-Agent": "Antigravity-GitProvider",
    }
    if (token) {
      headers["PRIVATE-TOKEN"] = token
    }

    const cleanFilePath = filePath.replace(/^\/+/, "")
    const encodedFilePath = encodeURIComponent(cleanFilePath)
    const refQuery = ref ? `?ref=${encodeURIComponent(ref.trim())}` : ""
    const rawUrl = `https://${parsed.host}/api/v4/projects/${parsed.encodedId}/repository/files/${encodedFilePath}/raw${refQuery}`

    const response = await this.fetchFn(rawUrl, { headers })

    if (response.status === 404) {
      throw new Error(`File not found: ${filePath}`)
    }

    if (response.status !== 200) {
      throw new Error(
        `GitLab API error (${response.status}) while reading ${filePath}`
      )
    }

    const content = await response.text()
    const contentLength = response.headers.get("content-length")
    const size = contentLength
      ? Number(contentLength)
      : Buffer.byteLength(content, "utf8")

    return {
      content,
      size,
    }
  }
}
