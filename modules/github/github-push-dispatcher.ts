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
