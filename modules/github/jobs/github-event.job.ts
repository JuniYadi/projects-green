/**
 * GitHub Webhook Event Job
 *
 * Processes queued GitHub webhook events asynchronously.
 * The API route validates the webhook signature, stores the event in the DB,
 * then dispatches this job. The handler fetches the stored event and processes it.
 *
 * Usage:
 *   await GithubEventJob.dispatch(eventId)
 */

import type { Job } from "bullmq"
import { BaseJob } from "@/lib/queue/base-job"
import { processGithubWebhookEvent } from "@/modules/github/github.webhook"

type GithubEventData = {
  eventId: string
}

export class GithubEventJob extends BaseJob {
  static readonly queue = "github-events"
  static readonly workerConcurrency = 4
  static readonly attempts = 5

  static async dispatch(eventId: string): Promise<void> {
    await this.enqueue<GithubEventData>(
      { eventId },
      { jobId: `github-event_${eventId}` }
    )
  }

  static async handle(job: Job<GithubEventData>): Promise<void> {
    const maxAttempts =
      typeof job.opts.attempts === "number" ? job.opts.attempts : 1

    await processGithubWebhookEvent({
      eventId: job.data.eventId,
      attemptNumber: job.attemptsMade + 1,
      maxAttempts,
    })
  }
}
