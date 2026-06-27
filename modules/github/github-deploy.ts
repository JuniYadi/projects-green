/**
 * GitHub deployment — YAML push to GitOps repo + Jenkins Job DSL upload
 * Migrated from Laravel GitHubDeploymentService.php
 */

import * as jsYaml from "js-yaml"

// ─── Config ─────────────────────────────────────────────────────────────────

export interface GitHubDeployConfig {
  enabled: boolean
  repository: string
  branch: string
  basePath: string
  chartRepository: string
  chartName: string
  chartVersion: string
  token: string
}

export function getGitHubDeployConfig(): GitHubDeployConfig {
  return {
    enabled: process.env["GITHUB_DEPLOYMENT_ENABLED"] !== "false",
    repository:
      process.env["GITHUB_DEPLOYMENT_REPOSITORY"] ?? "pfnapp/sgp-argocd-prod",
    branch: process.env["GITHUB_DEPLOYMENT_BRANCH"] ?? "main",
    basePath: process.env["GITHUB_DEPLOYMENT_BASE_PATH"] ?? "services-yaml",
    chartRepository:
      process.env["GITHUB_DEPLOYMENT_HELM_CHART_REPO_URL"] ??
      "https://pfnapp.github.io/charts",
    chartName: process.env["GITHUB_DEPLOYMENT_HELM_CHART_NAME"] ?? "deploy",
    chartVersion:
      process.env["GITHUB_DEPLOYMENT_HELM_CHART_VERSION"] ?? "2.5.0",
    token: process.env["GITHUB_TOKEN"] ?? "",
  }
}

// ─── GitHub API Helpers ──────────────────────────────────────────────────────

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "projects-green",
  }
}

async function githubRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  token: string,
  body?: unknown
): Promise<T> {
  const url = path.startsWith("http") ? path : `https://api.github.com${path}`
  const res = await fetch(url, {
    method,
    headers: githubHeaders(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub ${method} ${path} failed: ${res.status} - ${text}`)
  }

  return res.json() as Promise<T>
}

// ─── Deployment Result Types ────────────────────────────────────────────────

export interface YamlFile {
  filePath: string
  contents: unknown
}

export interface DeploymentResult {
  success: boolean
  application: string
  repository: string
  branch: string
  files: string[]
  message: string
  sha?: string
  error?: string
}

// ─── GitHub Deployment Service ───────────────────────────────────────────────

export class GitHubDeploymentService {
  constructor(private config: GitHubDeployConfig) {}

  static fromEnv(): GitHubDeploymentService {
    return new GitHubDeploymentService(getGitHubDeployConfig())
  }

  /**
   * Deploy YAML files to the GitOps repository.
   * Takes pre-generated Helm YAML files and pushes them via GitHub Contents API.
   */
  async deployStackToGitHub(
    applicationName: string,
    yamlFiles: YamlFile[]
  ): Promise<DeploymentResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        application: applicationName,
        repository: "",
        branch: "",
        files: [],
        message: "GitHub deployment disabled",
      }
    }

    if (!this.config.token) {
      return {
        success: false,
        application: applicationName,
        repository: "",
        branch: "",
        files: [],
        message: "GitHub token not configured",
      }
    }

    try {
      const flattened = this.flattenYamlFiles(yamlFiles)
      const files = flattened.map((f) => ({
        file: f.filePath,
        content:
          typeof f.contents === "string"
            ? f.contents
            : jsYaml.dump(f.contents, {
                indent: 2,
                lineWidth: -1,
                noRefs: true,
              }),
      }))

      const result = await this.pushBulkBlob(
        this.config.repository,
        this.config.branch,
        files,
        `Deploy ${applicationName}`
      )

      return {
        success: true,
        application: applicationName,
        repository: this.config.repository,
        branch: this.config.branch,
        files: files.map((f) => f.file),
        message: "Stack deployed to GitHub successfully",
        sha: result.sha,
      }
    } catch (error) {
      return {
        success: false,
        application: applicationName,
        repository: this.config.repository,
        branch: this.config.branch,
        files: [],
        message: `Deployment failed: ${error instanceof Error ? error.message : "Unknown"}`,
        error: error instanceof Error ? error.message : "Unknown",
      }
    }
  }

  /**
   * Upload Jenkins Job DSL (.groovy) to the Jenkins repo.
   */
  async uploadJenkinsJobDsl(
    stackSlug: string,
    jobDslContent: string,
    scriptName?: string
  ): Promise<DeploymentResult> {
    if (!this.config.token) {
      return {
        success: false,
        application: stackSlug,
        repository: "",
        branch: "",
        files: [],
        message: "GitHub token not configured",
      }
    }

    const repository = "pfnapp/Jenkins"
    const branch = "main"
    const jenkinsScriptName = scriptName ?? toJenkinsScriptName(stackSlug)
    const filePath = `jobs/${stackSlug}/${jenkinsScriptName}.groovy`
    const message = `Update Jenkins Job DSL for ${stackSlug}`

    try {
      // Test repo access
      await githubRequest("GET", `/repos/${repository}`, this.config.token)

      // Try single file upload first
      let result: { sha?: string; commit?: { sha?: string } }
      try {
        result = await this.uploadFile(
          repository,
          filePath,
          message,
          jobDslContent
        )
      } catch (e) {
        if (e instanceof Error && e.message.includes("404")) {
          // File doesn't exist — create via Contents API
          result = await this.createFileDirectly(
            repository,
            filePath,
            message,
            jobDslContent
          )
        } else {
          throw e
        }
      }

      return {
        success: true,
        application: stackSlug,
        repository,
        branch,
        files: [filePath],
        message,
        sha: result.commit?.sha,
      }
    } catch (error) {
      return {
        success: false,
        application: stackSlug,
        repository,
        branch,
        files: [filePath],
        message: `Jenkins Job DSL upload failed: ${error instanceof Error ? error.message : "Unknown"}`,
        error: error instanceof Error ? error.message : "Unknown",
      }
    }
  }

  /**
   * Push multiple files in one commit using GitHub Trees API.
   */
  private async pushBulkBlob(
    repository: string,
    branch: string,
    files: Array<{ file: string; content: string }>,
    message: string
  ): Promise<{ sha: string }> {
    // 1. Get current branch SHA
    const ref = await githubRequest<{ object: { sha: string } }>(
      "GET",
      `/repos/${repository}/git/refs/heads/${branch}`,
      this.config.token
    )
    const currentCommitSha = ref.object.sha

    // 2. Get current tree SHA
    const commit = await githubRequest<{ tree: { sha: string } }>(
      "GET",
      `/repos/${repository}/git/commits/${currentCommitSha}`,
      this.config.token
    )
    const baseTreeSha = commit.tree.sha

    // 3. Create blobs
    const blobs: Array<{ path: string; sha: string }> = []
    for (const f of files) {
      const blob = await githubRequest<{ sha: string }>(
        "POST",
        `/repos/${repository}/git/blobs`,
        this.config.token,
        { content: f.content, encoding: "utf-8" }
      )
      blobs.push({ path: f.file, sha: blob.sha })
    }

    // 4. Create tree
    const tree = blobs.map((b) => ({
      path: b.path,
      mode: "100644",
      type: "blob",
      sha: b.sha,
    }))
    const newTree = await githubRequest<{ sha: string }>(
      "POST",
      `/repos/${repository}/git/trees`,
      this.config.token,
      { base_tree: baseTreeSha, tree }
    )

    // 5. Create commit
    const newCommit = await githubRequest<{ sha: string }>(
      "POST",
      `/repos/${repository}/git/commits`,
      this.config.token,
      { message, tree: newTree.sha, parents: [currentCommitSha] }
    )

    // 6. Update branch ref
    await githubRequest(
      "PATCH",
      `/repos/${repository}/git/refs/heads/${branch}`,
      this.config.token,
      { sha: newCommit.sha }
    )

    return { sha: newCommit.sha }
  }

  /**
   * Upload a single file (GET → update, or POST → create new).
   */
  private async uploadFile(
    repository: string,
    filePath: string,
    message: string,
    content: string
  ): Promise<{ sha?: string; commit?: { sha?: string } }> {
    // Try to get existing file SHA
    try {
      const existing = await githubRequest<{ sha: string }>(
        "GET",
        `/repos/${repository}/contents/${filePath}`,
        this.config.token
      )
      // Update existing file
      return githubRequest(
        "PUT",
        `/repos/${repository}/contents/${filePath}`,
        this.config.token,
        {
          message,
          content: Buffer.from(content).toString("base64"),
          sha: existing.sha,
        }
      )
    } catch {
      // File doesn't exist
      return this.createFileDirectly(repository, filePath, message, content)
    }
  }

  /**
   * Create a new file via Contents API (no existing SHA needed).
   */
  private async createFileDirectly(
    repository: string,
    filePath: string,
    message: string,
    content: string
  ): Promise<{ sha?: string; commit?: { sha?: string } }> {
    return githubRequest(
      "PUT",
      `/repos/${repository}/contents/${filePath}`,
      this.config.token,
      {
        message,
        content: Buffer.from(content).toString("base64"),
      }
    )
  }

  /**
   * Flatten nested YAML file structures into a single array.
   */
  private flattenYamlFiles(yamlFiles: YamlFile[]): YamlFile[] {
    const flattened: YamlFile[] = []

    function process(value: unknown): void {
      if (!value) return
      if (Array.isArray(value)) {
        for (const item of value) process(item)
      } else if (typeof value === "object") {
        const obj = value as Record<string, unknown>
        if (obj["file_path"] && obj["contents"]) {
          flattened.push({
            filePath: obj["file_path"] as string,
            contents: obj["contents"],
          })
        } else {
          for (const v of Object.values(obj)) process(v)
        }
      }
    }

    for (const f of yamlFiles) {
      process(f.contents)
    }

    return flattened.length > 0 ? flattened : yamlFiles
  }
}

// ─── Slug Helper ─────────────────────────────────────────────────────────────

function toJenkinsScriptName(slug: string): string {
  return (
    slug
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") + ".groovy"
  )
}

// ─── GitHub App Token Refresh ────────────────────────────────────────────────

export interface GitHubAppConfig {
  appId: string
  privateKey: string
  installationId: string
}

export async function refreshGitHubAppToken(
  config: GitHubAppConfig
): Promise<{ token: string; expiresAt: string }> {
  const jwt = generateAppJWT(config.appId)

  const res = await fetch(
    `https://api.github.com/app/installations/${config.installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "projects-green",
      },
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub App token refresh failed: ${res.status} - ${text}`)
  }

  const data = (await res.json()) as { token: string; expires_at: string }
  return { token: data.token, expiresAt: data.expires_at }
}

function generateAppJWT(appId: string): string {
  // Minimal JWT generation without external deps
  // In production, use a proper JWT library (jose, jsonwebtoken)
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  ).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      iss: appId,
    })
  ).toString("base64url")

  // For actual signing, use Node.js crypto or a JWT library
  // This placeholder returns an unsigned token — caller should replace with real JWT
  return `${header}.${payload}.PLACEHOLDER`
}
