import { Queue, type JobsOptions, type RedisOptions } from "bullmq"
import { randomUUID } from "crypto"

export const WHATSAPP_WEBHOOK_QUEUE_NAME = "whatsapp-webhook"
export const WHATSAPP_WEBHOOK_JOB_NAME = "webhook-event"

export type WhatsAppWebhookEventType = "message" | "statuses" | "error"

export type WhatsAppWebhookJobData = {
  eventType: WhatsAppWebhookEventType
  payload: unknown
  deviceId: string
  organizationId?: string
}

export type WhatsAppWebhookQueue = {
  enqueue: (data: WhatsAppWebhookJobData, opts?: JobsOptions) => Promise<void>
  close: () => Promise<void>
}

type QueueAddOnly = {
  add: (
    name: string,
    data: WhatsAppWebhookJobData,
    opts?: JobsOptions
  ) => Promise<unknown>
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2_000,
  },
  removeOnComplete: 500,
  removeOnFail: 500,
}

const parseRedisDb = (pathname: string): number => {
  const trimmed = pathname.replace(/^\//, "")

  if (!trimmed) {
    return 0
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid REDIS_URL database path: "${pathname}". Expected empty path or numeric DB index.`
    )
  }

  const value = Number.parseInt(trimmed, 10)

  if (Number.isNaN(value) || value < 0) {
    throw new Error(
      `Invalid REDIS_URL database path: "${pathname}". Expected non-negative DB index.`
    )
  }

  return value
}

export const getWhatsAppWebhookRedisConnection = (): RedisOptions => {
  const redisUrl = process.env.REDIS_URL?.trim()

  if (!redisUrl) {
    throw new Error("Missing REDIS_URL environment variable")
  }

  const parsed = new URL(redisUrl)
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : 6379

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid REDIS_URL port")
  }

  return {
    host: parsed.hostname,
    port,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parseRedisDb(parsed.pathname),
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  }
}

export const createWhatsAppWebhookQueue = ({
  queue,
  queueName = WHATSAPP_WEBHOOK_QUEUE_NAME,
  jobName = WHATSAPP_WEBHOOK_JOB_NAME,
  defaultJobOptions = DEFAULT_JOB_OPTIONS,
}: {
  queue?: QueueAddOnly
  queueName?: string
  jobName?: string
  defaultJobOptions?: JobsOptions
} = {}): WhatsAppWebhookQueue => {
  const managedQueue = queue
  const ownedQueue = managedQueue
    ? null
    : new Queue<WhatsAppWebhookJobData>(queueName, {
        connection: getWhatsAppWebhookRedisConnection(),
        defaultJobOptions,
      })
  const queueClient: QueueAddOnly =
    managedQueue ?? (ownedQueue as Queue<WhatsAppWebhookJobData>)

  return {
    async enqueue(data, opts) {
      await queueClient.add(jobName, data, {
        jobId: `wa-webhook:${data.eventType}:${randomUUID()}`,
        ...opts,
      })
    },
    async close() {
      if (ownedQueue) {
        await ownedQueue.close()
      }
    },
  }
}

let sharedQueue: Queue<WhatsAppWebhookJobData> | null = null

const getSharedQueue = () => {
  if (sharedQueue) {
    return sharedQueue
  }

  sharedQueue = new Queue<WhatsAppWebhookJobData>(WHATSAPP_WEBHOOK_QUEUE_NAME, {
    connection: getWhatsAppWebhookRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  })

  return sharedQueue
}

/**
 * Enqueue a webhook event for async processing.
 */
export const enqueueWhatsAppWebhook = async (
  eventType: WhatsAppWebhookJobData["eventType"],
  payload: unknown,
  deviceId: string,
  organizationId?: string
) => {
  const queue = getSharedQueue()

  await queue.add(
    WHATSAPP_WEBHOOK_JOB_NAME,
    { eventType, payload, deviceId, organizationId },
    {
      jobId: `wa-webhook:${eventType}:${deviceId}:${randomUUID()}`,
    }
  )
}

export const __testing = {
  async resetQueueCache() {
    if (!sharedQueue) {
      return
    }

    await sharedQueue.close()
    sharedQueue = null
  },
}
