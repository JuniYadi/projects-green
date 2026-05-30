import { Queue, type JobsOptions, type RedisOptions } from "bullmq"

export const BILLING_DAILY_RESET_QUEUE = "billing-daily-reset"
export const BILLING_MONTHLY_RESET_QUEUE = "billing-monthly-reset"
export const BILLING_DAILY_RESET_JOB = "billing-daily-reset-job"
export const BILLING_MONTHLY_RESET_JOB = "billing-monthly-reset-job"
export const BILLING_MONTHLY_BILLING_JOB = "billing-monthly-billing-job"

export type BillingCronJobData = Record<string, never>

export type BillingCronQueue = {
  close: () => Promise<void>
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5_000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
}

const parseRedisDb = (pathname: string) => {
  const trimmed = pathname.replace(/^\//, "")

  if (!trimmed) {
    return 0
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid REDIS_URL database path: "${pathname}". Expected empty path or numeric DB index.`,
    )
  }

  const value = Number.parseInt(trimmed, 10)

  if (Number.isNaN(value) || value < 0) {
    throw new Error(
      `Invalid REDIS_URL database path: "${pathname}". Expected empty path or non-negative DB index.`,
    )
  }

  return value
}

export const getBillingRedisConnection = (): RedisOptions => {
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

export const createBillingCronQueues = (): BillingCronQueue => {
  const queues: Queue<BillingCronJobData>[] = []

  // Daily queue
  queues.push(
    new Queue(BILLING_DAILY_RESET_QUEUE, {
      connection: getBillingRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  )

  // Monthly queue
  queues.push(
    new Queue(BILLING_MONTHLY_RESET_QUEUE, {
      connection: getBillingRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }),
  )

  return {
    close: async () => {
      await Promise.all(queues.map((q) => q.close()))
    },
  }
}

export const __testing = {
  queues: [] as Queue<BillingCronJobData>[],
}
