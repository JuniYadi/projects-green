import { Queue } from "bullmq"

const QUEUE_NAME = "github-webhook-events"

type QueueShape = Pick<Queue, "add" | "close">

let queue: QueueShape | null = null

const getRedisUrl = () => {
  const redisUrl = process.env.REDIS_URL?.trim()

  if (!redisUrl) {
    throw new Error("Missing REDIS_URL environment variable")
  }

  return redisUrl
}

const getConnectionOptions = () => {
  const redisUrl = new URL(getRedisUrl())
  const port = redisUrl.port ? Number.parseInt(redisUrl.port, 10) : 6379

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid REDIS_URL port")
  }

  return {
    host: redisUrl.hostname,
    port,
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    tls: redisUrl.protocol === "rediss:" ? {} : undefined,
  }
}

const getQueue = () => {
  if (queue) {
    return queue
  }

  queue = new Queue(QUEUE_NAME, {
    connection: getConnectionOptions(),
  })

  return queue
}

export const enqueueGithubWebhookEvent = async (eventId: string) => {
  const eventsQueue = getQueue()

  await eventsQueue.add(
    "github-webhook-event",
    { eventId },
    {
      jobId: eventId,
      removeOnComplete: true,
      removeOnFail: 2000,
    },
  )
}

export const __testing = {
  resetQueueCache() {
    if (queue) {
      void queue.close()
      queue = null
    }
  },
}
