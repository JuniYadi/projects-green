import { Queue, type JobsOptions, type RedisOptions } from "bullmq"

export const QUOTA_RECONCILIATION_QUEUE = "quota-reconciliation"
export const QUOTA_RECONCILIATION_JOB = "quota-reconciliation-job"

export type QuotaReconciliationJobData = {
  organizationId: string
  deviceId: string
  direction: "IN" | "OUT"
  messageId: string
  timestamp: string
}

export type QuotaReconciliationQueue = {
  enqueue: (
    data: QuotaReconciliationJobData,
    opts?: JobsOptions
  ) => Promise<void>
  close: () => Promise<void>
}

type QueueAddOnly = {
  add: (
    name: string,
    data: QuotaReconciliationJobData,
    opts?: JobsOptions
  ) => Promise<unknown>
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5_000,
  },
  removeOnComplete: 500,
  removeOnFail: 1000,
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

export const getQuotaReconciliationRedisConnection = (): RedisOptions => {
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

export const createQuotaReconciliationQueue = ({
  queue,
  queueName = QUOTA_RECONCILIATION_QUEUE,
  jobName = QUOTA_RECONCILIATION_JOB,
  defaultJobOptions = DEFAULT_JOB_OPTIONS,
}: {
  queue?: QueueAddOnly
  queueName?: string
  jobName?: string
  defaultJobOptions?: JobsOptions
} = {}): QuotaReconciliationQueue => {
  const managedQueue = queue
  const ownedQueue = managedQueue
    ? null
    : new Queue<QuotaReconciliationJobData>(queueName, {
        connection: getQuotaReconciliationRedisConnection(),
        defaultJobOptions,
      })
  const queueClient: QueueAddOnly =
    managedQueue ?? (ownedQueue as Queue<QuotaReconciliationJobData>)

  return {
    async enqueue(data, opts) {
      await queueClient.add(jobName, data, {
        jobId: `quota-recon:${data.organizationId}:${data.deviceId}:${data.messageId}`,
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

let sharedQueue: Queue<QuotaReconciliationJobData> | null = null

const getSharedQueue = () => {
  if (sharedQueue) {
    return sharedQueue
  }

  sharedQueue = new Queue<QuotaReconciliationJobData>(
    QUOTA_RECONCILIATION_QUEUE,
    {
      connection: getQuotaReconciliationRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }
  )

  return sharedQueue
}

/**
 * Enqueue a quota reconciliation job for async processing.
 * Called when quota deduction fails but message was already sent.
 */
export const enqueueQuotaReconciliation = async (
  organizationId: string,
  deviceId: string,
  direction: "IN" | "OUT",
  messageId: string,
  timestamp: Date = new Date()
) => {
  const queue = getSharedQueue()

  await queue.add(QUOTA_RECONCILIATION_JOB, {
    organizationId,
    deviceId,
    direction,
    messageId,
    timestamp: timestamp.toISOString(),
  })
}

export const __testing = {
  parseRedisDb,
  async resetQueueCache() {
    if (!sharedQueue) {
      return
    }

    await sharedQueue.close()
    sharedQueue = null
  },
}
