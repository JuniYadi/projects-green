import { Worker, type Job } from "bullmq"

import {
  WHATSAPP_BROADCAST_JOB_NAME,
  WHATSAPP_BROADCAST_QUEUE_NAME,
  getWhatsAppBroadcastRedisConnection,
  type WhatsAppBroadcastJobData,
} from "@/lib/queue/whatsapp-broadcast"

const redisConnection = getWhatsAppBroadcastRedisConnection()

const worker = new Worker<WhatsAppBroadcastJobData>(
  WHATSAPP_BROADCAST_QUEUE_NAME,
  async (job: Job<WhatsAppBroadcastJobData>) => {
    const maxAttempts =
      typeof job.opts.attempts === "number" ? job.opts.attempts : 1

    if (job.data.method === "dispatch") {
      // TODO: implement actual dispatch via WhatsAppDeviceClient
      console.info(
        `[whatsapp-broadcast-worker] would dispatch campaign=${job.data.campaignId} recipient=${job.data.recipientId}`
      )
      return
    }

    if (job.data.method === "throttle") {
      // TODO: apply token-bucket rate limiting via BroadcastRateState
      console.info(
        `[whatsapp-broadcast-worker] throttle campaign=${job.data.campaignId} recipient=${job.data.recipientId}`
      )
      return
    }

    if (job.data.method === "status-update") {
      // TODO: update campaign status in Prisma
      console.info(
        `[whatsapp-broadcast-worker] status-update campaign=${job.data.campaignId} recipient=${job.data.recipientId}`
      )
      return
    }
  },
  {
    connection: redisConnection,
    concurrency: 4,
  }
)

worker.on("active", (job) => {
  console.info(
    `[whatsapp-broadcast-worker] processing ${job.name} id=${job.id} campaign=${job.data.campaignId}`
  )
})

worker.on("completed", (job) => {
  console.info(
    `[whatsapp-broadcast-worker] completed ${job.name} id=${job.id}`
  )
})

worker.on("failed", (job, error) => {
  if (!job) {
    console.error(
      "[whatsapp-broadcast-worker] failed job missing payload",
      error
    )
    return
  }

  console.error(
    `[whatsapp-broadcast-worker] failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`,
    error
  )
})

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.info(`[whatsapp-broadcast-worker] received ${signal}, shutting down`)

  try {
    await worker.close()
    process.exit(0)
  } catch (error) {
    console.error(
      "[whatsapp-broadcast-worker] shutdown failed while closing worker",
      error
    )
    process.exit(1)
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})
