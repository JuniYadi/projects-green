import { Worker, type Job } from "bullmq"

import { logger } from "@/lib/logger"
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
  logger.info(
    {
      event: "github.worker.job.active",
      jobName: job.name,
      jobId: job.id,
      eventId: job.data.eventId,
    },
    `[github-worker] processing ${job.name} id=${job.id} eventId=${job.data.eventId}`
  )
})

worker.on("completed", (job) => {
  logger.info(
    {
      event: "github.worker.job.completed",
      jobName: job.name,
      jobId: job.id,
      eventId: job.data.eventId,
    },
    `[github-worker] completed ${job.name} id=${job.id} eventId=${job.data.eventId}`
  )
})

worker.on("failed", (job, error) => {
  if (!job) {
    logger.error(
      {
        event: "github.worker.job.failed",
        err: error,
      },
      "[github-worker] failed job missing payload"
    )
    return
  }

  logger.error(
    {
      event: "github.worker.job.failed",
      jobName: job.name,
      jobId: job.id,
      attempts: job.attemptsMade,
      eventId: job.data.eventId,
      err: error,
    },
    `[github-worker] failed ${job.name} id=${job.id} attempts=${job.attemptsMade} eventId=${job.data.eventId}`
  )
})

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info(
    {
      event: "github.worker.shutdown",
      signal,
    },
    `[github-worker] received ${signal}, shutting down`
  )

  try {
    await worker.close()
    process.exit(0)
  } catch (error) {
    logger.error(
      {
        event: "github.worker.shutdown.failed",
        err: error,
      },
      "[github-worker] shutdown failed while closing worker"
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

logger.info(
  {
    event: "github.worker.ready",
    queue: GITHUB_EVENTS_QUEUE_NAME,
    job: GITHUB_EVENTS_JOB_NAME,
  },
  `[github-worker] ready queue=${GITHUB_EVENTS_QUEUE_NAME} job=${GITHUB_EVENTS_JOB_NAME}`
)
