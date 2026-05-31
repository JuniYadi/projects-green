import { createHmac, timingSafeEqual } from "node:crypto"
import { triggerJenkinsJob } from "@/modules/jenkins/jenkins.service"

export interface GithubPushPayload {
  ref: string
  after: string
  commits: Array<{
    id: string
    message: string
    author: {
      name: string
      email: string
      username?: string
    }
    url: string
    timestamp: string
  }>
  pusher: {
    name: string
    email: string
  }
  repository: {
    id: number
    full_name: string
    name: string
    owner: {
      login: string
    }
  }
  deleted?: boolean
}

export interface StackMetadata {
  lastPush?: {
    ref: string
    commitCount: number
    author: string
    timestamp: string
  }
  [key: string]: any
}

export interface Stack {
  id: string
  autoDeploy: boolean
  branchFilter?: string
  jenkinsJobName: string
  metadata: StackMetadata
}

export class GithubPushEventHandler {
  /**
   * Main entry for push events
   */
  async handlePush(stack: Stack, payload: GithubPushPayload): Promise<void> {
    const branch = this.extractBranch(payload.ref)
    
    if (!branch) {
      console.log(`[GitHubPushEventHandler] Skipped stack ${stack.id}: Invalid ref ${payload.ref}`)
      return
    }

    if (!this.shouldTriggerDeploy(stack, branch)) {
      console.log(`[GitHubPushEventHandler] Skipped stack ${stack.id}: Auto-deploy disabled or branch mismatch`)
      return
    }

    const commits = this.extractCommits(payload)
    const pusher = payload.pusher.name || payload.pusher.email

    // Sync metadata
    await this.syncPushMetadata(stack, branch, commits, pusher)

    // Trigger deployment
    const dispatcher = new GithubPushDispatcher()
    await dispatcher.dispatchDeployment(stack, payload)
  }

  /**
   * Strips refs/heads/ to get branch name
   */
  extractBranch(ref: string): string | null {
    if (!ref.startsWith("refs/heads/")) {
      return null
    }
    return ref.replace("refs/heads/", "")
  }

  /**
   * Extracts first 10 commits with id/message/author/url
   */
  extractCommits(payload: GithubPushPayload, limit = 10) {
    return (payload.commits || []).slice(0, limit).map(commit => ({
      id: commit.id,
      message: commit.message,
      author: commit.author.name || commit.author.username || "Unknown",
      url: commit.url
    }))
  }

  /**
   * Checks auto_deploy + branch filter
   */
  shouldTriggerDeploy(stack: Stack, branch: string): boolean {
    if (!stack.autoDeploy) {
      return false
    }

    if (stack.branchFilter) {
      const filters = stack.branchFilter
        .split(",")
        .map((f) => f.trim().toLowerCase())
        .filter((f) => f.length > 0)
      return filters.includes(branch.toLowerCase())
    }

    return true
  }

  /**
   * Update stack metadata (stub for now, writes to DB eventually)
   */
  async syncPushMetadata(stack: Stack, branch: string, commits: any[], pusher: string): Promise<void> {
    stack.metadata = {
      ...stack.metadata,
      lastPush: {
        ref: branch,
        commitCount: commits.length,
        author: pusher,
        timestamp: new Date().toISOString()
      }
    }
    
    // Stub: updateStackMetadata(stack.id, stack.metadata)
    console.log(`[GitHubPushEventHandler] Updated metadata for stack ${stack.id}`)
  }
}

export class GithubPushDispatcher {
  /**
   * Dispatches deployment when push received
   */
  async dispatchDeployment(stack: Stack, pushPayload: GithubPushPayload): Promise<void> {
    const branch = pushPayload.ref.replace("refs/heads/", "")
    
    console.log(`[GitHubPushDispatcher] Dispatching deployment for stack ${stack.id} on branch ${branch}`)
    
    const params = {
      GIT_REF: branch,
      GIT_COMMIT: pushPayload.after,
      PUSHER: pushPayload.pusher.name,
      STACK_ID: stack.id
    }

    try {
      await triggerJenkinsJob(stack.jenkinsJobName, params)
      console.log(`[GitHubPushDispatcher] Successfully triggered Jenkins job ${stack.jenkinsJobName} for stack ${stack.id}`)
    } catch (error) {
      console.error(`[GitHubPushDispatcher] Failed to trigger Jenkins job for stack ${stack.id}:`, error)
      throw error
    }
  }
}

/**
 * Verifies HMAC-SHA256 signature from GitHub
 */
export function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac("sha256", secret)
  const digest = "sha256=" + hmac.update(payload).digest("hex")

  const expected = Buffer.from(digest)
  const received = Buffer.from(signature)

  // timingSafeEqual throws on length mismatch — guard against malformed headers
  if (expected.length !== received.length) {
    return false
  }

  return timingSafeEqual(expected, received)
}

/**
 * Parse push payload and extract standard fields
 */
export function parsePushPayload(body: any): GithubPushPayload {
  if (typeof body === "string") {
    return JSON.parse(body)
  }
  return body
}
