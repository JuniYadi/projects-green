import { createHmac, timingSafeEqual } from "node:crypto"
import { triggerDeploy } from "@/modules/deploy/deploy-pipeline.service"
import { prisma } from "@/lib/prisma"

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  async handlePush(stack: Stack, payload: GithubPushPayload): Promise<void> {
    const branch = this.extractBranch(payload.ref)

    if (!branch) {
      console.log(
        `[GitHubPushEventHandler] Skipped stack ${stack.id}: Invalid ref ${payload.ref}`
      )
      return
    }

    if (!this.shouldTriggerDeploy(stack, branch)) {
      console.log(
        `[GitHubPushEventHandler] Skipped stack ${stack.id}: Auto-deploy disabled or branch mismatch`
      )
      return
    }

    const commits = this.extractCommits(payload)
    const pusher = payload.pusher.name || payload.pusher.email

    await this.syncPushMetadata(stack, branch, commits, pusher)

    const dispatcher = new GithubPushDispatcher()
    await dispatcher.dispatchDeployment(stack, branch, payload)
  }

  extractBranch(ref: string): string | null {
    if (!ref.startsWith("refs/heads/")) {
      return null
    }
    return ref.replace("refs/heads/", "")
  }

  extractCommits(payload: GithubPushPayload, limit = 10) {
    return (payload.commits || []).slice(0, limit).map((commit) => ({
      id: commit.id,
      message: commit.message,
      author: commit.author.name || commit.author.username || "Unknown",
      url: commit.url,
    }))
  }

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

  async syncPushMetadata(
    stack: Stack,
    branch: string,
    commits: Array<{
      id: string
      message: string
      author: string
      url: string
    }>,
    pusher: string
  ): Promise<void> {
    stack.metadata = {
      ...stack.metadata,
      lastPush: {
        ref: branch,
        commitCount: commits.length,
        author: pusher,
        timestamp: new Date().toISOString(),
      },
    }

    console.log(
      `[GitHubPushEventHandler] Updated metadata for stack ${stack.id}`
    )
  }
}

export class GithubPushDispatcher {
  async dispatchDeployment(
    stack: Stack,
    branch: string,
    pushPayload: GithubPushPayload
  ): Promise<void> {
    console.log(
      `[GitHubPushDispatcher] Dispatching deployment for stack ${stack.id} on branch ${branch}`
    )

    const params = {
      GIT_REF: branch,
      GIT_COMMIT: pushPayload.after,
      PUSHER: pushPayload.pusher.name,
      STACK_ID: stack.id,
    }

    try {
      await triggerJenkinsJob(stack.jenkinsJobName, params)
      console.log(
        `[GitHubPushDispatcher] Successfully triggered Jenkins job ${stack.jenkinsJobName} for stack ${stack.id}`
      )
    } catch (error) {
      console.error(
        `[GitHubPushDispatcher] Failed to trigger Jenkins job for stack ${stack.id}:`,
        error
      )
      throw error
    }
  }
}

export function parsePushPayload(
  raw: Record<string, unknown>
): GithubPushPayload {
  const pusher = raw.pusher as Record<string, unknown> | undefined
  const repository = raw.repository as Record<string, unknown> | undefined
  const owner = repository?.owner as Record<string, unknown> | undefined

  return {
    ref: (raw.ref as string) ?? "",
    after: (raw.after as string) ?? "",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    commits: ((raw.commits as unknown[]) ?? []).map((c: any) => ({
      id: (c.id as string) ?? "",
      message: (c.message as string) ?? "",
      author: {
        name: ((c.author as Record<string, unknown>)?.name as string) ?? "",
        email: ((c.author as Record<string, unknown>)?.email as string) ?? "",
        username: (c.author as Record<string, unknown>)?.username as
          | string
          | undefined,
      },
      url: (c.url as string) ?? "",
      timestamp: (c.timestamp as string) ?? "",
    })),
    pusher: {
      name: (pusher?.name as string) ?? "",
      email: (pusher?.email as string) ?? "",
    },
    repository: {
      id: (repository?.id as number) ?? 0,
      full_name: (repository?.full_name as string) ?? "",
      name: (repository?.name as string) ?? "",
      owner: {
        login: (owner?.login as string) ?? "",
      },
    },
    deleted: raw.deleted as boolean | undefined,
  }
}

export function verifyGitHubSignature(
  payload: string,
  signature: string | null | undefined,
  secret: string
): boolean {
  if (!payload || !signature || !secret) {
    return false
  }

  const hmac = createHmac("sha256", secret)
  const digest = "sha256=" + hmac.update(payload).digest("hex")

  const expected = Buffer.from(digest)
  const received = Buffer.from(signature)

  if (expected.length !== received.length) {
    return false
  }

  return timingSafeEqual(expected, received)
}

export function createJenkinsPushDispatcher() {
  return async (payload: {
    webhookEventId: string
    connectionId: string
    branch: string
    payload: Record<string, unknown>
  }) => {
    const commitSha = (payload.payload.after as string) || ""
    const shortSha = commitSha.length >= 7 ? commitSha.slice(0, 7) : commitSha
    const repo = payload.payload.repository as Record<string, unknown> | undefined

    // Find all ApplicationStack records for this connection + branch
    const stacks = await prisma.applicationStack.findMany({
      where: {
        repositoryConnectionId: payload.connectionId,
        branchName: payload.branch,
      },
    })

    if (stacks.length === 0) {
      console.log(
        `[push-dispatcher] No stacks found for connection ${payload.connectionId} branch ${payload.branch}`
      )
      return { jobId: null }
    }

    let triggered = 0
    for (const stack of stacks) {
      // Dedup: ignore if same commit SHA within last 5 minutes
      if (commitSha) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
        const recent = await prisma.applicationDeployment.findFirst({
          where: {
            stackId: stack.id,
            commitSha,
            createdAt: { gte: fiveMinutesAgo },
          },
        })
        if (recent) {
          console.log(
            `[push-dispatcher] Skipping stack ${stack.slug}: same commit ${shortSha} deployed within 5min`
          )
          continue
        }
      }

      try {
        await triggerDeploy({
          stackId: stack.id,
          triggerType: "GITHUB",
        })
        triggered++
      } catch (error) {
        console.error(
          `[push-dispatcher] Failed to trigger deploy for stack ${stack.slug}:`,
          error
        )
      }
    }

    return { jobId: triggered > 0 ? `${repo?.name ?? "unknown"}/${shortSha || "unknown"}` : null }
  }
}
