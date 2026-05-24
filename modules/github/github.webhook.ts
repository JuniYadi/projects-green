import { createHash, createHmac, timingSafeEqual } from "node:crypto"

import {
  createGithubEventsQueue,
  type GithubEventsQueue,
} from "@/lib/queue/github-events"

const SIGNATURE_PREFIX = "sha256="
const SIGNATURE_HEX_LENGTH = 64

type JsonObject = Record<string, unknown>

type GithubWebhookPayload = JsonObject & {
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
  create: (args: {
    data: Record<string, unknown>
  }) => Promise<GithubWebhookEventRecord>
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

export type GithubWebhookRecord = {
  id: string
}

export type CreateGithubWebhookEventInput = {
  deliveryId: string
  eventName: string
  action: string | null
  githubInstallationId: bigint | null
  githubRepositoryId: bigint | null
  payloadJson: JsonObject
  payloadSha256: string
}

export type GithubWebhookHandlerEventStore = {
  findByDeliveryId: (deliveryId: string) => Promise<GithubWebhookRecord | null>
  create: (input: CreateGithubWebhookEventInput) => Promise<GithubWebhookRecord>
  markEnqueueFailed: (eventId: string, processError: string) => Promise<void>
}

export type GithubWebhookQueueProducer = {
  enqueueEventId: (eventId: string) => Promise<void>
}

export type GithubWebhookHandlerDeps = {
  webhookSecret: string | null | undefined
  store: GithubWebhookHandlerEventStore
  queue: GithubWebhookQueueProducer
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

const getHeaderValue = (request: Request, name: string) => {
  const raw = request.headers.get(name)

  if (!raw) {
    return null
  }

  const value = raw.trim()
  return value.length > 0 ? value : null
}

const parseSignature = (signature: string) => {
  if (!signature.startsWith(SIGNATURE_PREFIX)) {
    return null
  }

  const hash = signature.slice(SIGNATURE_PREFIX.length).trim()

  if (hash.length !== SIGNATURE_HEX_LENGTH) {
    return null
  }

  if (!/^[a-f0-9]+$/i.test(hash)) {
    return null
  }

  return hash.toLowerCase()
}

const toNullableBigInt = (value: unknown) => {
  if (typeof value === "bigint") {
    return value
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value)
  }

  if (typeof value === "string" && /^-?[0-9]+$/.test(value)) {
    return BigInt(value)
  }

  return null
}

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return "Unknown processing error"
}

const isUniqueConstraintError = (error: unknown) => {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error as Record<string, any>).code === "P2002"
  )
}

const hashPayload = (rawBody: string) => {
  return createHash("sha256").update(rawBody).digest("hex")
}

const parsePayload = (rawBody: string): JsonObject | null => {
  try {
    const parsed = JSON.parse(rawBody) as unknown

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }

    return parsed as JsonObject
  } catch {
    return null
  }
}

const parseWebhookPayload = (rawBody: string): GithubWebhookPayload => {
  const payload = parsePayload(rawBody)

  if (!payload) {
    throw new Error("Invalid webhook payload JSON")
  }

  return payload as GithubWebhookPayload
}

let sharedQueue: GithubEventsQueue | null = null

const getSharedQueue = () => {
  if (sharedQueue) {
    return sharedQueue
  }

  sharedQueue = createGithubEventsQueue()
  return sharedQueue
}

export const signGithubWebhookBody = (rawBody: string, secret: string) => {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex")
  return `${SIGNATURE_PREFIX}${digest}`
}

export const verifyGithubWebhookSignature = ({
  rawBody,
  signatureHeader,
  signature,
  secret,
}: {
  rawBody: string
  signatureHeader?: string
  signature?: string
  secret: string
}) => {
  const providedSignature = signatureHeader ?? signature

  if (!providedSignature) {
    return false
  }

  const receivedHash = parseSignature(providedSignature)

  if (!receivedHash) {
    return false
  }

  const expectedHash = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")

  const receivedBuffer = Buffer.from(receivedHash, "hex")
  const expectedBuffer = Buffer.from(expectedHash, "hex")

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer)
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

  if (!normalizedBranch || !branchFilters.length) {
    return false
  }

  return branchFilters.some(
    (candidate) => candidate.trim() === normalizedBranch
  )
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

export const createGithubWebhookHandler = (deps: GithubWebhookHandlerDeps) => {
  return async (request: Request) => {
    const eventName = getHeaderValue(request, "X-GitHub-Event")
    const deliveryId = getHeaderValue(request, "X-GitHub-Delivery")
    const signatureHeader = getHeaderValue(request, "X-Hub-Signature-256")

    if (!eventName || !deliveryId || !signatureHeader) {
      return Response.json(
        {
          ok: false as const,
          error: "MISSING_GITHUB_HEADERS" as const,
          message: "Missing required GitHub webhook headers.",
        },
        { status: 400 }
      )
    }

    const webhookSecret = deps.webhookSecret?.trim()

    if (!webhookSecret) {
      return Response.json(
        {
          ok: false as const,
          error: "MISSING_WEBHOOK_SECRET" as const,
          message: "Missing GITHUB_WEBHOOK_SECRET configuration.",
        },
        { status: 500 }
      )
    }

    const rawBody = await request.text()
    const isSignatureValid = verifyGithubWebhookSignature({
      rawBody,
      signatureHeader,
      secret: webhookSecret,
    })

    if (!isSignatureValid) {
      return Response.json(
        {
          ok: false as const,
          error: "INVALID_SIGNATURE" as const,
          message: "Webhook signature verification failed.",
        },
        { status: 401 }
      )
    }

    const payload = parsePayload(rawBody)

    if (!payload) {
      return Response.json(
        {
          ok: false as const,
          error: "INVALID_PAYLOAD" as const,
          message: "Webhook payload must be a valid JSON object.",
        },
        { status: 400 }
      )
    }

    const existingEvent = await deps.store.findByDeliveryId(deliveryId)

    if (existingEvent) {
      return Response.json(
        {
          ok: true as const,
          duplicate: true as const,
          eventId: existingEvent.id,
        },
        { status: 202 }
      )
    }

    const installation =
      payload.installation &&
      typeof payload.installation === "object" &&
      !Array.isArray(payload.installation)
        ? (payload.installation as Record<string, unknown>)
        : null
    const repository =
      payload.repository &&
      typeof payload.repository === "object" &&
      !Array.isArray(payload.repository)
        ? (payload.repository as Record<string, unknown>)
        : null
    const action =
      typeof payload.action === "string" && payload.action.trim().length > 0
        ? payload.action
        : null

    let event!: GithubWebhookRecord
    try {
      event = await deps.store.create({
        deliveryId,
        eventName,
        action,
        githubInstallationId: toNullableBigInt(installation?.id),
        githubRepositoryId: toNullableBigInt(repository?.id),
        payloadJson: payload,
        payloadSha256: hashPayload(rawBody),
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existingEventAfterRace =
          await deps.store.findByDeliveryId(deliveryId)

        return Response.json(
          {
            ok: true as const,
            duplicate: true as const,
            eventId: existingEventAfterRace?.id,
          },
          { status: 202 }
        )
      }

      throw error
    }

    try {
      await deps.queue.enqueueEventId(event.id)
    } catch (error) {
      await deps.store.markEnqueueFailed(event.id, toErrorMessage(error))

      return Response.json(
        {
          ok: false as const,
          error: "ENQUEUE_FAILED" as const,
          message: "Unable to enqueue webhook event.",
        },
        { status: 503 }
      )
    }

    return Response.json(
      {
        ok: true as const,
        eventId: event.id,
      },
      { status: 202 }
    )
  }
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
    ((await import("@/lib/prisma"))
      .prisma as unknown as GithubWebhookPrismaClient)

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

  let created: GithubWebhookEventRecord

  try {
    created = await dbClient.githubWebhookEvent.create({
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
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    const existing = await dbClient.githubWebhookEvent.findUnique({
      where: {
        deliveryId,
      },
    })

    if (!existing) {
      throw error
    }

    return {
      ok: true as const,
      status: 202,
      deduplicated: true,
      eventId: existing.id,
    }
  }

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
    ((await import("@/lib/prisma"))
      .prisma as unknown as GithubWebhookPrismaClient)

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
        enqueueStatus: isTerminalAttempt
          ? "dead_lettered"
          : event.enqueueStatus,
        processError: `${idempotencyKey}: ${toErrorMessage(error)}`,
        processedAt: isTerminalAttempt ? new Date() : null,
      },
    })

    throw error
  }
}
