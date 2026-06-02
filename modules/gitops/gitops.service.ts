import { createPrivateKey, sign } from "node:crypto"

export interface GitFile {
  path: string
  content: string
}

export class GitOpsRepositoryService {
  private repoBaseUrl = process.env.GITOPS_REPO_BASE_URL || "https://api.github.com"
  private pat = process.env.GITOPS_REPO_PAT

  /**
   * Commit multiple files to a repository in a single atomic operation using Trees API.
   * @param repo Full repository name (e.g., "owner/repo")
   * @param message Commit message
   * @param files Files to create or update
   * @param deletePaths Paths to delete
   */
  async commitFiles(
    repo: string,
    message: string,
    files: GitFile[],
    deletePaths: string[] = []
  ): Promise<{ sha: string }> {
    const branch = "main" // Default branch
    
    // Use PAT if available, otherwise we'd need an installation ID.
    // For now, we assume GITOPS_REPO_PAT is configured or logic uses installationToken.
    const token = await this.getAccessToken()

    // 1. Get current branch SHA
    const baseRef = await this.getRef(repo, branch, token)
    const baseSha = baseRef.object.sha

    // 2. Create blobs for new/updated files
    const treeItems: Array<{
      path: string
      mode: "100644" | "100755" | "040000" | "160000" | "120000"
      type: "blob" | "tree" | "commit"
      sha: string | null
    }> = await Promise.all(
      files.map(async (file) => {
        const blob = await this.createBlob(repo, file.content, token)
        return {
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        }
      })
    )

    // 3. Add deletions to tree
    for (const path of deletePaths) {
      treeItems.push({
        path,
        mode: "100644" as const,
        type: "blob" as const,
        sha: null, // Deletion in Tree API
      })
    }

    // 4. Create new tree
    const tree = await this.createTree(repo, treeItems, baseSha, token)

    // 5. Create commit
    const commit = await this.createCommit(repo, message, tree.sha, [baseSha], token)

    // 6. Update branch ref
    await this.updateRef(repo, branch, commit.sha, token)

    return { sha: commit.sha }
  }

  /**
   * Wrapped fetch with GitHub API rate limit handling.
   * Detects 403 with X-RateLimit-Remaining: 0, waits for reset, retries once.
   */
  private async githubFetch(url: string, options: RequestInit, retried = false): Promise<Response> {
    const res = await fetch(url, options)

    if (res.status === 403) {
      const remaining = res.headers.get("X-RateLimit-Remaining")
      if (remaining === "0" && !retried) {
        const resetEpoch = res.headers.get("X-RateLimit-Reset")
        if (resetEpoch) {
          const waitMs = Math.max(0, parseInt(resetEpoch, 10) * 1000 - Date.now()) + 1000
          console.warn(`[GitOps] Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`)
          await new Promise((resolve) => setTimeout(resolve, waitMs))
          return this.githubFetch(url, options, true)
        }
      }
    }

    return res
  }

  private async getRef(repo: string, ref: string, token: string) {
    const res = await this.githubFetch(
      `${this.repoBaseUrl}/repos/${repo}/git/refs/heads/${ref}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    )
    if (!res.ok) throw new Error(`Failed to get ref: ${await res.text()}`)
    return res.json() as Promise<{ object: { sha: string } }>
  }

  private async createBlob(repo: string, content: string, token: string) {
    const res = await this.githubFetch(
      `${this.repoBaseUrl}/repos/${repo}/git/blobs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          encoding: "utf-8",
        }),
      }
    )
    if (!res.ok) throw new Error(`Failed to create blob: ${await res.text()}`)
    return res.json() as Promise<{ sha: string }>
  }

  private async createTree(repo: string, tree: { path: string, mode: "100644" | "100755" | "040000" | "160000" | "120000", type: "blob" | "tree" | "commit", sha: string | null }[], baseTree: string, token: string) {
    const res = await this.githubFetch(
      `${this.repoBaseUrl}/repos/${repo}/git/trees`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_tree: baseTree,
          tree,
        }),
      }
    )
    if (!res.ok) throw new Error(`Failed to create tree: ${await res.text()}`)
    return res.json() as Promise<{ sha: string }>
  }

  private async createCommit(repo: string, message: string, tree: string, parents: string[], token: string) {
    const res = await this.githubFetch(
      `${this.repoBaseUrl}/repos/${repo}/git/commits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          tree,
          parents,
        }),
      }
    )
    if (!res.ok) throw new Error(`Failed to create commit: ${await res.text()}`)
    return res.json() as Promise<{ sha: string }>
  }

  private async updateRef(repo: string, ref: string, sha: string, token: string) {
    const res = await this.githubFetch(
      `${this.repoBaseUrl}/repos/${repo}/git/refs/heads/${ref}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sha, force: false }),
      }
    )
    if (!res.ok) throw new Error(`Failed to update ref: ${await res.text()}`)
    return res.json()
  }

  private async getAccessToken(): Promise<string> {
    if (this.pat) return this.pat
    
    // In production, we would use the installation ID to get a token
    // This requires GITHUB_APP_INSTALLATION_ID env var
    const installationId = process.env.GITOPS_REPO_INSTALLATION_ID
    if (installationId) {
      return this.createInstallationToken(BigInt(installationId))
    }

    throw new Error("Neither GITOPS_REPO_PAT nor GITOPS_REPO_INSTALLATION_ID is set.")
  }

  async createInstallationToken(installationId: bigint): Promise<string> {
    const appJwt = this.generateAppJwt()
    const res = await fetch(`${this.repoBaseUrl}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github.v3+json",
      },
    })
    if (!res.ok) throw new Error(`Failed to create installation token: ${await res.text()}`)
    const data = await res.json() as { token: string }
    return data.token
  }

  private generateAppJwt(): string {
    const appId = process.env.GITHUB_APP_ID
    const privateKeyBase64 = process.env.GITHUB_APP_PRIVATE_KEY_BASE64
    if (!appId || !privateKeyBase64) {
      throw new Error("GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY_BASE64 is not set")
    }

    const privateKeyPem = Buffer.from(privateKeyBase64, "base64").toString("utf8")
    
    const issuedAt = Math.floor(Date.now() / 1000)
    // 8.5 min (9 min max minus 30s clock-skew buffer). GitHub allows up to 10 min
    // but our infra (NTP-synced) stays within ±2s of GPS time, so 30s is ample.
    const expiresAt = issuedAt + 9 * 60 - 30
    const header = { alg: "RS256", typ: "JWT" }
    const payload = { iat: issuedAt, exp: expiresAt, iss: appId }

    const toBase64Url = (str: string) => Buffer.from(str).toString("base64url")
    const unsignedToken = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`

    const key = createPrivateKey(privateKeyPem)
    const signature = sign("RSA-SHA256", Buffer.from(unsignedToken), key)

    return `${unsignedToken}.${Buffer.from(signature).toString("base64url")}`
  }
}
