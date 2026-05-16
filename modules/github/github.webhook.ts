import { createHash, createHmac, timingSafeEqual } from "node:crypto"

const SIGNATURE_PREFIX = "sha256="
const SIGNATURE_HEX_LENGTH = 64

type JsonObject = Record<string, unknown>

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

export type GithubWebhookEventStore = {
  findByDeliveryId: (
    deliveryId: string,
  ) => Promise<GithubWebhookRecord | null>
  create: (
    input: CreateGithubWebhookEventInput,
  ) => Promise<GithubWebhookRecord>
  markEnqueueFailed: (
    eventId: string,
    processError: string,
  ) => Promise<void>
}

export type GithubWebhookQueueProducer = {
  enqueueEventId: (
    eventId: string,
  ) => Promise<void>
}

export type GithubWebhookHandlerDeps = {
  webhookSecret: string | null | undefined
  store: GithubWebhookEventStore
  queue: GithubWebhookQueueProducer
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

export const signGithubWebhookBody = (rawBody: string, secret: string) => {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex")
  return `${SIGNATURE_PREFIX}${digest}`
}

export const verifyGithubWebhookSignature = ({
  rawBody,
  signatureHeader,
  secret,
}: {
  rawBody: string
  signatureHeader: string
  secret: string
}) => {
  const receivedHash = parseSignature(signatureHeader)

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

const toProcessErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "string") {
    return error
  }

  return "Unknown enqueue error"
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
          message:
            "Missing required GitHub webhook headers.",
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

    const event = await deps.store.create({
      deliveryId,
      eventName,
      action,
      githubInstallationId: toNullableBigInt(installation?.id),
      githubRepositoryId: toNullableBigInt(repository?.id),
      payloadJson: payload,
      payloadSha256: createHash("sha256").update(rawBody).digest("hex"),
    })

    try {
      await deps.queue.enqueueEventId(event.id)
    } catch (error) {
      await deps.store.markEnqueueFailed(event.id, toProcessErrorMessage(error))

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
