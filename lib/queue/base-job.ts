/**
 * Base Job Class
 *
 * Contract for all BullMQ jobs. Each job extends this class and overrides:
 *   - `queue` (required) — queue name
 *   - `handle()` (required) — the job processing logic
 *   - Any config it needs to change (concurrency, attempts, backoff, etc.)
 *
 * The base class provides:
 *   - Sensible defaults (concurrency, retry, backoff, cleanup)
 *   - `enqueue()` — add a job to the queue with default options
 *   - `enqueueBulk()` — add multiple jobs in bulk
 *   - `createWorker()` — BullMQ Worker with built-in event logging
 *   - `registerRepeatable()` — schedule a cron or interval job
 *
 * Example:
 *   export class GithubEventJob extends BaseJob {
 *     static readonly queue = "github-events"
 *     static readonly concurrency = 4
 *
 *     static async dispatch(eventId: string) {
 *       await this.enqueue({ eventId }, { jobId: `github-event_${eventId}` })
 *     }
 *
 *     static async handle(job: Job<GithubEventData>) {
 *       await processGithubWebhookEvent({ eventId: job.data.eventId })
 *     }
 *   }
 */

import { Worker, Queue, type Job, type JobsOptions } from "bullmq"
import {
  getRedisConnection,
  getQueueRuntimeConfig,
} from "@/lib/queue/queue-config"

// ── Default Configuration ───────────────────────────────────────────────────

const DEFAULTS = {
  concurrency: 1,
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { count: 1_000 },
  removeOnFail: { count: 1_000 },
} as const

// ── Base Class ──────────────────────────────────────────────────────────────

export abstract class BaseJob {
  /** Queue name (required override). */
  static readonly queue: string

  /** Job name used in BullMQ. Defaults to class name. */
  static get jobName(): string {
    return this.name
  }

  /**
   * Number of concurrent workers processing this queue.
   * Note: This controls the Worker's concurrency, NOT the Queue's behavior.
   * Set via createWorker() — has no effect on enqueue().
   */
  static readonly workerConcurrency: number = DEFAULTS.concurrency

  /** Max retry attempts for failed jobs. */
  static readonly attempts: number = DEFAULTS.attempts

  /** Backoff strategy for retries. */
  static readonly backoff: JobsOptions["backoff"] = DEFAULTS.backoff

  /** How many completed jobs to keep in Redis. */
  static readonly removeOnComplete: JobsOptions["removeOnComplete"] =
    DEFAULTS.removeOnComplete

  /** How many failed jobs to keep in Redis. */
  static readonly removeOnFail: JobsOptions["removeOnFail"] =
    DEFAULTS.removeOnFail

  // ── Producer ──────────────────────────────────────────────────────────────

  /**
   * Enqueue a job with the default job options merged.
   * Subclasses call this from their `dispatch()` method.
   *
   * Example:
   *   static async dispatch(eventId: string) {
   *     await this.enqueue({ eventId }, { jobId: `github-event_${eventId}` })
   *   }
   */
  static async enqueue<T>(data: T, opts?: JobsOptions): Promise<void> {
    const queue = new Queue(this.queue, {
      connection: getQueueRuntimeConfig().connection,
      prefix: getQueueRuntimeConfig().prefix,
    })
    await queue.add(this.jobName, data as unknown, {
      attempts: this.attempts,
      backoff: this.backoff,
      removeOnComplete: this.removeOnComplete,
      removeOnFail: this.removeOnFail,
      ...opts,
    })
    await queue.close()
  }

  /**
   * Enqueue multiple jobs in bulk.
   */
  static async enqueueBulk<T>(
    items: Array<{ data: T; opts?: JobsOptions }>,
  ): Promise<void> {
    const queue = new Queue(this.queue, {
      connection: getQueueRuntimeConfig().connection,
      prefix: getQueueRuntimeConfig().prefix,
    })
    await queue.addBulk(
      items.map((item) => ({
        name: this.jobName,
        data: item.data as unknown,
        opts: {
          attempts: this.attempts,
          backoff: this.backoff,
          removeOnComplete: this.removeOnComplete,
          removeOnFail: this.removeOnFail,
          ...item.opts,
        },
      })),
    )
    await queue.close()
  }

  // ── Consumer ──────────────────────────────────────────────────────────────

  /**
   * Process a job. MUST be overridden by each subclass.
   *
   * This is the function passed directly to BullMQ Worker.
   * It receives the raw BullMQ Job — access data via `job.data`.
   */
  static async handle(_job: Job): Promise<void> {
    throw new Error(`${this.name}.handle() not implemented`)
  }

  // ── Worker Factory ────────────────────────────────────────────────────────

  /**
   * Create a BullMQ Worker for this job with built-in event logging.
   * Used by the unified worker entry point.
   *
   * Example:
   *   const worker = GithubEventJob.createWorker()
   *   // ... later: await worker.close()
   */
  static createWorker(): Worker {
    const connection = getRedisConnection()

    return new Worker(this.queue, this.handle, {
      connection,
      concurrency: this.workerConcurrency,
    })
  }

  /**
   * Returns the worker options object for use in the unified worker registry.
   * Use this when you want to manage the Worker lifecycle yourself.
   */
  static toWorkerOptions() {
    return {
      connection: getRedisConnection(),
      concurrency: this.workerConcurrency,
    }
  }

  // ── Repeatable Jobs ───────────────────────────────────────────────────────

  /**
   * Register a repeatable job schedule (cron or interval).
   * Idempotent — safe to call on every startup.
   *
   * Example (in job class):
   *   static async registerSchedule() {
   *     await this.registerRepeatable({ pattern: "0 0 * * *" })
   *   }
   */
  static async registerRepeatable(
    repeat: { pattern: string } | { every: number },
    data?: unknown,
    opts?: JobsOptions,
  ): Promise<void> {
    const queue = new Queue(this.queue, {
      connection: getQueueRuntimeConfig().connection,
      prefix: getQueueRuntimeConfig().prefix,
    })
    const repeatOpts =
      "pattern" in repeat
        ? { pattern: repeat.pattern }
        : { every: repeat.every }

    await queue.add(this.jobName, (data ?? {}) as unknown, {
      repeat: repeatOpts,
      jobId: `${this.jobName}-repeatable`,
      ...opts,
    })

    await queue.close()
  }
}
