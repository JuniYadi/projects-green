import { Worker, type Job } from "bullmq"

import {
  WHATSAPP_TEMPLATE_SYNC_JOB_NAME,
  WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
  getWhatsAppTemplateSyncRedisConnection,
  type WhatsAppTemplateSyncJobData,
} from "@/lib/queue/whatsapp-template-sync"

const redisConnection = getWhatsAppTemplateSyncRedisConnection()

const worker = new Worker<WhatsAppTemplateSyncJobData>(
  WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
  async (job: Job<WhatsAppTemplateSyncJobData>) => {
    const maxAttempts =
      typeof job.opts.attempts === "number" ? job.opts.attempts : 1

    if (job.data.method === "sync-templates") {
      // TODO: fetch templates from Meta Cloud API and upsert into Prisma
      console.info(
        `[whatsapp-template-sync-worker] sync-templates org=${job.data.organizationId} device=${job.data.deviceId}`
      )
      return
    }

    if (job.data.method === "sync-status") {
      // TODO: fetch template status from Meta Cloud and update Prisma records
      console.info(
        `[whatsapp-template-sync-worker] sync-status org=${job.data.organizationId} device=${job.data.deviceId}`
      )
      return
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
)

worker.on("active", (job) => {
  console.info(
    `[whatsapp-template-sync-worker] processing ${job.name} id=${job.id}`
  )
})

worker.on("completed", (job) => {
  console.info(
    `[whatsapp-template-sync-worker] completed ${job.name} id=${job.id}`
  )
})

worker.on("failed", (job, error) => {
  if (!job) {
    console.error(
      "[whatsapp-template-sync-worker] failed job missing payload",
      error
    )
    return
  }

  console.error(
    `[whatsapp-template-sync-worker] failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`,
    error
  )
})

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.info(
    `[whatsapp-template-sync-worker] received ${signal}, shutting down`
  )

  try {
    await worker.close()
    process.exit(0)
  } catch (error) {
    console.error(
      "[whatsapp-template-sync-worker] shutdown failed while closing worker",
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
