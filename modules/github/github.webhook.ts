import { createHash, createHmac, timingSafeEqual } from "node:crypto"

import {
  createGithubEventsQueue,
  type GithubEventsQueue,
} from "@/lib/queue/github-events"

type GithubWebhookPayload = {
  action?: string
  deleted?: boolean
  ref?: string
  installation?: {
    id?: number
  }
  repository?: {
    id?: number
    full_name?: string
  }
}

type GithubWebhookEventRecord = {
  id: string
  deliveryId: string
  eventName: string
  action: string | null
  githubInstallationId: bigint | null
  githubRepositoryId: bigint | null
  payloadJson: unknown
  payloadSha256: string
  enqueueStatus: string
  processStatus: string
}

type GithubRepositoryConnectionRecord = {
  id: string
  enabled: boolean
  branchFilters: string[]
}

type GithubWebhookEventStore = {
  create: (args: { data: Record<string, unknown> }) => Promise<GithubWebhookEventRecord>
  findUnique: (args: {
    where: {
      id?: string
      deliveryId?: string
    }
  }) => Promise<GithubWebhookEventRecord | null>
  update: (args: {
    where: {
      id: string
    }
    data: Record<string, unknown>
  }) => Promise<unknown>
  updateMany: (args: {
    where: Record<string, unknown>
    data: Record<string, unknown>
  }) => Promise<{ count: number }>
}

type GithubRepositoryConnectionStore = {
  findFirst: (args: {
    where: Record<string, unknown>
    select: {
      id: true
      enabled: true
      branchFilters: true
    }
  }) => Promise<GithubRepositoryConnectionRecord | null>
}

type GithubWebhookPrismaClient = {
  githubWebhookEvent: GithubWebhookEventStore
  githubRepositoryConnection: GithubRepositoryConnectionStore
}

export type BuildDispatchPayload = {
  webhookEventId: string
  connectionId: string
  branch: string
  payload: GithubWebhookPayload
}

export type BuildDispatcher = (
  payload: BuildDispatchPayload
) => Promise<{ jobId: string | null }>

export type ProcessWebhookEventResult =
  | {
      outcome: "processed"
      branch: string
    }
  | {
      outcome: "ignored"
      reason: string
    }
  | {
      outcome: "duplicate"
    }
  | {
      outcome: "missing"
    }

export const extractBranchFromRef = (ref: string | undefined | null) => {
  if (!ref || !ref.startsWith("refs/heads/")) {
    return null
  }

  return ref.replace(/^refs\/heads\//, "")
}

export const matchesBranchFilters = ({
  branch,
  branchFilters,
}: {
  branch: string
  branchFilters: string[]
}) => {
  const normalizedBranch = branch.trim()

  if (!normalizedBranch) {
    return false
  }

  if (!branchFilters.length) {
    return false
  }

  return branchFilters.some((candidate) => candidate.trim() === normalizedBranch)
}

export const evaluatePushRules = ({
  payload,
  connection,
}: {
  payload: GithubWebhookPayload
  connection: GithubRepositoryConnectionRecord
}):
  | {
      shouldDispatch: true
      branch: string
    }
  | {
      shouldDispatch: false
      reason: string
    } => {
  if (!connection.enabled) {
    return {
      shouldDispatch: false,
      reason: "CONNECTION_DISABLED",
    }
  }

  if (payload.deleted) {
    return {
      shouldDispatch: false,
      reason: "PUSH_DELETED",
    }
  }

  const branch = extractBranchFromRef(payload.ref)

  if (!branch) {
    return {
      shouldDispatch: false,
      reason: "NON_HEAD_REF",
    }
  }

  const branchMatched = matchesBranchFilters({
    branch,
    branchFilters: connection.branchFilters,
  })

  if (!branchMatched) {
    return {
      shouldDispatch: false,
      reason: "BRANCH_FILTER_MISS",
    }
  }

  return {
    shouldDispatch: true,
    branch,
  }
}

const normalizeSignature = (signature: string) => {
  const trimmed = signature.trim()

  if (trimmed.startsWith("sha256=")) {
    return trimmed
  }

  return `sha256=${trimmed}`
}

export const verifyGithubWebhookSignature = ({
  rawBody,
  signature,
  secret,
}: {
  rawBody: string
  signature: string
  secret: string
}) => {
  const expectedSignature = normalizeSignature(
    createHmac("sha256", secret).update(rawBody).digest("hex")
  )
  const providedSignature = normalizeSignature(signature)

  const expectedBuffer = Buffer.from(expectedSignature)
  const providedBuffer = Buffer.from(providedSignature)

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  return "Unknown processing error"
}

const hashPayload = (rawBody: string) => {
  return createHash("sha256").update(rawBody).digest("hex")
}

const parseWebhookPayload = (rawBody: string): GithubWebhookPayload => {
  try {
    return JSON.parse(rawBody) as GithubWebhookPayload
  } catch {
    throw new Error("Invalid webhook payload JSON")
  }
}

let sharedQueue: GithubEventsQueue | null = null

const getSharedQueue = () => {
  if (sharedQueue) {
    return sharedQueue
  }

  sharedQueue = createGithubEventsQueue()
  return sharedQueue
}

export const enqueueGithubWebhookEvent = async ({
  eventName,
  deliveryId,
  signature,
  rawBody,
  prismaClient,
  queue,
}: {
  eventName: string
  deliveryId: string
  signature: string
  rawBody: string
  prismaClient?: GithubWebhookPrismaClient
  queue?: GithubEventsQueue
}) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim()

  if (!secret) {
    throw new Error("Missing GITHUB_WEBHOOK_SECRET environment variable")
  }

  const signatureValid = verifyGithubWebhookSignature({
    rawBody,
    signature,
    secret,
  })

  if (!signatureValid) {
    return {
      ok: false as const,
      error: "INVALID_SIGNATURE" as const,
      status: 403,
    }
  }

  const payload = parseWebhookPayload(rawBody)
  const dbClient =
    prismaClient ??
    ((await import("@/lib/prisma")).prisma as unknown as GithubWebhookPrismaClient)

  const duplicate = await dbClient.githubWebhookEvent.findUnique({
    where: {
      deliveryId,
    },
  })

  if (duplicate) {
    return {
      ok: true as const,
      status: 202,
      deduplicated: true,
      eventId: duplicate.id,
    }
  }

  const installationId = payload.installation?.id
  const repositoryId = payload.repository?.id

  const created = await dbClient.githubWebhookEvent.create({
    data: {
      deliveryId,
      eventName,
      action: payload.action ?? null,
      githubInstallationId:
        typeof installationId === "number" ? BigInt(installationId) : null,
      githubRepositoryId:
        typeof repositoryId === "number" ? BigInt(repositoryId) : null,
      payloadJson: payload,
      payloadSha256: hashPayload(rawBody),
      signatureValid: true,
      enqueueStatus: "queued",
      processStatus: "pending",
    },
  })

  const enqueueClient = queue ?? getSharedQueue()

  try {
    await enqueueClient.enqueue({
      eventId: created.id,
    })

    await dbClient.githubWebhookEvent.update({
      where: {
        id: created.id,
      },
      data: {
        enqueueStatus: "enqueued",
      },
    })

    return {
      ok: true as const,
      status: 202,
      deduplicated: false,
      eventId: created.id,
    }
  } catch (error) {
    await dbClient.githubWebhookEvent.update({
      where: {
        id: created.id,
      },
      data: {
        enqueueStatus: "enqueue_failed",
        processStatus: "failed",
        processError: toErrorMessage(error),
      },
    })

    return {
      ok: false as const,
      status: 500,
      error: "QUEUE_ENQUEUE_FAILED" as const,
    }
  }
}

const getIdempotencyKey = ({
  deliveryId,
  eventName,
}: {
  deliveryId: string
  eventName: string
}) => {
  return `${deliveryId}:${eventName}`
}

export const dispatchInternalBuildJob: BuildDispatcher = async () => {
  return {
    jobId: null,
  }
}

export const processGithubWebhookEvent = async ({
  eventId,
  attemptNumber,
  maxAttempts,
  prismaClient,
  buildDispatcher = dispatchInternalBuildJob,
}: {
  eventId: string
  attemptNumber: number
  maxAttempts: number
  prismaClient?: GithubWebhookPrismaClient
  buildDispatcher?: BuildDispatcher
}): Promise<ProcessWebhookEventResult> => {
  const dbClient =
    prismaClient ??
    ((await import("@/lib/prisma")).prisma as unknown as GithubWebhookPrismaClient)

  const event = await dbClient.githubWebhookEvent.findUnique({
    where: {
      id: eventId,
    },
  })

  if (!event) {
    return {
      outcome: "missing",
    }
  }

  const idempotencyKey = getIdempotencyKey({
    deliveryId: event.deliveryId,
    eventName: event.eventName,
  })

  const idempotencyLock = await dbClient.githubWebhookEvent.updateMany({
    where: {
      id: event.id,
      eventName: event.eventName,
      deliveryId: event.deliveryId,
      processStatus: {
        in: ["pending", "retrying"],
      },
    },
    data: {
      processStatus: "processing",
      processError: null,
    },
  })

  if (idempotencyLock.count === 0) {
    return {
      outcome: "duplicate",
    }
  }

  try {
    const payload = event.payloadJson as GithubWebhookPayload

    if (event.eventName !== "push") {
      await dbClient.githubWebhookEvent.update({
        where: {
          id: event.id,
        },
        data: {
          processStatus: "ignored",
          processError: null,
          processedAt: new Date(),
        },
      })

      return {
        outcome: "ignored",
        reason: "EVENT_NOT_SUPPORTED",
      }
    }

    if (!event.githubInstallationId || !event.githubRepositoryId) {
      await dbClient.githubWebhookEvent.update({
        where: {
          id: event.id,
        },
        data: {
          processStatus: "ignored",
          processError: null,
          processedAt: new Date(),
        },
      })

      return {
        outcome: "ignored",
        reason: "MISSING_INSTALLATION_OR_REPOSITORY",
      }
    }

    const connection = await dbClient.githubRepositoryConnection.findFirst({
      where: {
        githubRepositoryId: event.githubRepositoryId,
        installation: {
          githubInstallationId: event.githubInstallationId,
        },
      },
      select: {
        id: true,
        enabled: true,
        branchFilters: true,
      },
    })

    if (!connection) {
      await dbClient.githubWebhookEvent.update({
        where: {
          id: event.id,
        },
        data: {
          processStatus: "ignored",
          processError: null,
          processedAt: new Date(),
        },
      })

      return {
        outcome: "ignored",
        reason: "REPOSITORY_CONNECTION_NOT_FOUND",
      }
    }

    const evaluation = evaluatePushRules({
      payload,
      connection,
    })

    if (!evaluation.shouldDispatch) {
      await dbClient.githubWebhookEvent.update({
        where: {
          id: event.id,
        },
        data: {
          processStatus: "ignored",
          processError: evaluation.reason,
          processedAt: new Date(),
        },
      })

      return {
        outcome: "ignored",
        reason: evaluation.reason,
      }
    }

    await buildDispatcher({
      webhookEventId: event.id,
      connectionId: connection.id,
      branch: evaluation.branch,
      payload,
    })

    await dbClient.githubWebhookEvent.update({
      where: {
        id: event.id,
      },
      data: {
        processStatus: "processed",
        processError: null,
        processedAt: new Date(),
      },
    })

    return {
      outcome: "processed",
      branch: evaluation.branch,
    }
  } catch (error) {
    const isTerminalAttempt = attemptNumber >= maxAttempts

    await dbClient.githubWebhookEvent.update({
      where: {
        id: event.id,
      },
      data: {
        processStatus: isTerminalAttempt ? "dead_lettered" : "retrying",
        enqueueStatus: isTerminalAttempt ? "dead_lettered" : event.enqueueStatus,
        processError: `${idempotencyKey}: ${toErrorMessage(error)}`,
        processedAt: isTerminalAttempt ? new Date() : null,
      },
    })

    throw error
  }
}
