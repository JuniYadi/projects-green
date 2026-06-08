import { Queue, type JobsOptions, type RedisOptions } from "bullmq"

export const GITHUB_EVENTS_QUEUE_NAME = "github-events"
export const GITHUB_EVENTS_JOB_NAME = "process-github-webhook-event"

export type GithubEventJobData = {
  eventId: string
}

export type GithubEventsQueue = {
  enqueue: (data: GithubEventJobData) => Promise<void>
  close: () => Promise<void>
}

type QueueAddOnly = {
  add: (
    name: string,
    data: GithubEventJobData,
    opts?: JobsOptions
  ) => Promise<unknown>
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 5_000,
  },
  removeOnComplete: 1_000,
  removeOnFail: 1_000,
}

const parseRedisDb = (pathname: string) => {
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
      `Invalid REDIS_URL database path: "${pathname}". Expected empty path or non-negative DB index.`
    )
  }

  return value
}

export const getGithubEventsRedisConnection = (): RedisOptions => {
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

export const createGithubEventsQueue = ({
  queue,
  queueName = GITHUB_EVENTS_QUEUE_NAME,
  jobName = GITHUB_EVENTS_JOB_NAME,
  defaultJobOptions = DEFAULT_JOB_OPTIONS,
}: {
  queue?: QueueAddOnly
  queueName?: string
  jobName?: string
  defaultJobOptions?: JobsOptions
} = {}): GithubEventsQueue => {
  const managedQueue = queue
  const ownedQueue = managedQueue
    ? null
    : new Queue<GithubEventJobData>(queueName, {
        connection: getGithubEventsRedisConnection(),
        defaultJobOptions,
      })
  const queueClient: QueueAddOnly =
    managedQueue ?? (ownedQueue as Queue<GithubEventJobData>)

  return {
    async enqueue(data) {
      await queueClient.add(jobName, data, {
        jobId: `github-event_${data.eventId}`,
      })
    },
    async close() {
      if (ownedQueue) {
        await ownedQueue.close()
      }
    },
  }
}

let sharedQueue: Queue<GithubEventJobData> | null = null

const getSharedQueue = () => {
  if (sharedQueue) {
    return sharedQueue
  }

  sharedQueue = new Queue<GithubEventJobData>(GITHUB_EVENTS_QUEUE_NAME, {
    connection: getGithubEventsRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  })

  return sharedQueue
}

// Compatibility helper used by app route ingestion path.
export const enqueueGithubWebhookEvent = async (eventId: string) => {
  const queue = getSharedQueue()

  await queue.add(
    GITHUB_EVENTS_JOB_NAME,
    { eventId },
    {
      jobId: `github-event_${eventId}`,
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
