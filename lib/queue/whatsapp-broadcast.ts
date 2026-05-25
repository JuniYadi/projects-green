import { Queue, type JobsOptions, type RedisOptions } from "bullmq"

export const WHATSAPP_BROADCAST_QUEUE_NAME = "whatsapp-broadcast"
export const WHATSAPP_BROADCAST_JOB_NAME = "broadcast-dispatch"

export type WhatsAppBroadcastJobData = {
  campaignId: string
  recipientId: string
  method: "dispatch" | "throttle" | "status-update"
}

export type WhatsAppBroadcastQueue = {
  enqueue: (data: WhatsAppBroadcastJobData, opts?: JobsOptions) => Promise<void>
  close: () => Promise<void>
}

type QueueAddOnly = {
  add: (
    name: string,
    data: WhatsAppBroadcastJobData,
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

export const getWhatsAppBroadcastRedisConnection = (): RedisOptions => {
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

export const createWhatsAppBroadcastQueue = ({
  queue,
  queueName = WHATSAPP_BROADCAST_QUEUE_NAME,
  jobName = WHATSAPP_BROADCAST_JOB_NAME,
  defaultJobOptions = DEFAULT_JOB_OPTIONS,
}: {
  queue?: QueueAddOnly
  queueName?: string
  jobName?: string
  defaultJobOptions?: JobsOptions
} = {}): WhatsAppBroadcastQueue => {
  const managedQueue = queue
  const ownedQueue = managedQueue
    ? null
    : new Queue<WhatsAppBroadcastJobData>(queueName, {
        connection: getWhatsAppBroadcastRedisConnection(),
        defaultJobOptions,
      })
  const queueClient: QueueAddOnly =
    managedQueue ?? (ownedQueue as Queue<WhatsAppBroadcastJobData>)

  return {
    async enqueue(data, opts) {
      await queueClient.add(jobName, data, {
        jobId: `wa-broadcast:${data.campaignId}:${data.recipientId}`,
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

let sharedQueue: Queue<WhatsAppBroadcastJobData> | null = null

const getSharedQueue = () => {
  if (sharedQueue) {
    return sharedQueue
  }

  sharedQueue = new Queue<WhatsAppBroadcastJobData>(WHATSAPP_BROADCAST_QUEUE_NAME, {
    connection: getWhatsAppBroadcastRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  })

  return sharedQueue
}

/**
 * Enqueue a broadcast dispatch job.
 */
export const enqueueWhatsAppBroadcast = async (
  campaignId: string,
  recipientId: string,
  method: WhatsAppBroadcastJobData["method"] = "dispatch"
) => {
  const queue = getSharedQueue()

  await queue.add(
    WHATSAPP_BROADCAST_JOB_NAME,
    { campaignId, recipientId, method },
    {
      jobId: `wa-broadcast:${campaignId}:${recipientId}`,
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
