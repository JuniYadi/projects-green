import { Worker, type Job } from "bullmq"

import {
  GITHUB_EVENTS_JOB_NAME,
  GITHUB_EVENTS_QUEUE_NAME,
  getGithubEventsRedisConnection,
  type GithubEventJobData,
} from "@/lib/queue/github-events"
import { processGithubWebhookEvent } from "@/modules/github/github.webhook"

const redisConnection = getGithubEventsRedisConnection()

const worker = new Worker<GithubEventJobData>(
  GITHUB_EVENTS_QUEUE_NAME,
  async (job: Job<GithubEventJobData>) => {
    const maxAttempts =
      typeof job.opts.attempts === "number" ? job.opts.attempts : 1

    await processGithubWebhookEvent({
      eventId: job.data.eventId,
      attemptNumber: job.attemptsMade + 1,
      maxAttempts,
    })
  },
  {
    connection: redisConnection,
    concurrency: 4,
  }
)

worker.on("active", (job) => {
  console.info(
    `[github-worker] processing ${job.name} id=${job.id} eventId=${job.data.eventId}`
  )
})

worker.on("completed", (job) => {
  console.info(
    `[github-worker] completed ${job.name} id=${job.id} eventId=${job.data.eventId}`
  )
})

worker.on("failed", (job, error) => {
  if (!job) {
    console.error("[github-worker] failed job missing payload", error)
    return
  }

  console.error(
    `[github-worker] failed ${job.name} id=${job.id} attempts=${job.attemptsMade} eventId=${job.data.eventId}`,
    error
  )
})

const shutdown = async (signal: string) => {
  console.info(`[github-worker] received ${signal}, shutting down`)
  await worker.close()
  process.exit(0)
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

console.info(
  `[github-worker] ready queue=${GITHUB_EVENTS_QUEUE_NAME} job=${GITHUB_EVENTS_JOB_NAME}`
)
