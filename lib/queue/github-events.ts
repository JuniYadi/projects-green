import { Queue } from "bullmq"
import IORedis from "ioredis"

const QUEUE_NAME = "github-webhook-events"

type QueueShape = Pick<Queue, "add">

let redisConnection: IORedis | null = null
let queue: QueueShape | null = null

const getRedisUrl = () => {
  const redisUrl = process.env.REDIS_URL?.trim()

  if (!redisUrl) {
    throw new Error("Missing REDIS_URL environment variable")
  }

  return redisUrl
}

const getQueue = () => {
  if (queue) {
    return queue
  }

  redisConnection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
  })

  queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
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
    queue = null

    if (redisConnection) {
      void redisConnection.disconnect(false)
      redisConnection = null
    }
  },
}
