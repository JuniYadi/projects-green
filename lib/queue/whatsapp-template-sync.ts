import { Queue, type JobsOptions, type RedisOptions } from "bullmq"

export const WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME = "whatsapp-template-sync"
export const WHATSAPP_TEMPLATE_SYNC_JOB_NAME = "sync-templates"

export type WhatsAppTemplateSyncJobData = {
  organizationId: string
  deviceId: string
  method: "sync-templates" | "sync-status"
}

export type WhatsAppTemplateSyncQueue = {
  enqueue: (
    data: WhatsAppTemplateSyncJobData,
    opts?: JobsOptions
  ) => Promise<void>
  close: () => Promise<void>
}

type QueueAddOnly = {
  add: (
    name: string,
    data: WhatsAppTemplateSyncJobData,
    opts?: JobsOptions
  ) => Promise<unknown>
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000,
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

export const getWhatsAppTemplateSyncRedisConnection = (): RedisOptions => {
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

export const createWhatsAppTemplateSyncQueue = ({
  queue,
  queueName = WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
  jobName = WHATSAPP_TEMPLATE_SYNC_JOB_NAME,
  defaultJobOptions = DEFAULT_JOB_OPTIONS,
}: {
  queue?: QueueAddOnly
  queueName?: string
  jobName?: string
  defaultJobOptions?: JobsOptions
} = {}): WhatsAppTemplateSyncQueue => {
  const managedQueue = queue
  const ownedQueue = managedQueue
    ? null
    : new Queue<WhatsAppTemplateSyncJobData>(queueName, {
        connection: getWhatsAppTemplateSyncRedisConnection(),
        defaultJobOptions,
      })
  const queueClient: QueueAddOnly =
    managedQueue ?? (ownedQueue as Queue<WhatsAppTemplateSyncJobData>)

  return {
    async enqueue(data, opts) {
      await queueClient.add(jobName, data, {
        jobId: `wa-template-sync:${data.organizationId}:${data.deviceId}:${data.method}`,
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

let sharedQueue: Queue<WhatsAppTemplateSyncJobData> | null = null

const getSharedQueue = () => {
  if (sharedQueue) {
    return sharedQueue
  }

  sharedQueue = new Queue<WhatsAppTemplateSyncJobData>(
    WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
    {
      connection: getWhatsAppTemplateSyncRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }
  )

  return sharedQueue
}

/**
 * Enqueue a template sync job (scheduled cron or manual trigger).
 */
export const enqueueWhatsAppTemplateSync = async (
  organizationId: string,
  deviceId: string,
  method: WhatsAppTemplateSyncJobData["method"] = "sync-templates"
) => {
  const queue = getSharedQueue()

  await queue.add(
    WHATSAPP_TEMPLATE_SYNC_JOB_NAME,
    { organizationId, deviceId, method },
    {
      jobId: `wa-template-sync:${organizationId}:${deviceId}:${method}`,
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
