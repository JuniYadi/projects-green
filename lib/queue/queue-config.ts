import { Queue, type ConnectionOptions } from "bullmq"

const DEFAULT_LOCAL_REDIS_URL = "redis://127.0.0.1:6379"
const DEFAULT_QUEUE_PREFIX = "pfnapp"
const DEFAULT_GITHUB_EVENTS_QUEUE_NAME = "github-events"

const getOptionalEnv = (name: string) => {
  const value = process.env[name]?.trim()

  if (!value) {
    return undefined
  }

  return value
}

const parseRedisDb = (pathname: string) => {
  const value = pathname.replace(/^\//, "")

  if (!value) {
    return 0
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      "REDIS_URL must include a valid non-negative database index"
    )
  }

  return parsed
}

const getRedisUrl = () => {
  const explicit = getOptionalEnv("REDIS_URL")

  if (explicit) {
    return explicit
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing REDIS_URL environment variable")
  }

  return DEFAULT_LOCAL_REDIS_URL
}

const parseRedisUrl = (redisUrl: string) => {
  let parsed: URL

  try {
    parsed = new URL(redisUrl)
  } catch {
    throw new Error("REDIS_URL must be a valid URL")
  }

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss:// protocol")
  }

  return {
    protocol: parsed.protocol,
    host: parsed.hostname,
    port: Number.parseInt(parsed.port || "6379", 10),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parseRedisDb(parsed.pathname),
  }
}

export type QueueRuntimeConfig = {
  redisConnectionLabel: string
  connection: ConnectionOptions
  prefix: string
  githubEventsQueueName: string
}

export const getQueueRuntimeConfig = (): QueueRuntimeConfig => {
  const redisUrl = getRedisUrl()
  const parsed = parseRedisUrl(redisUrl)
  const prefix = getOptionalEnv("QUEUE_PREFIX") || DEFAULT_QUEUE_PREFIX
  const githubEventsQueueName =
    getOptionalEnv("GITHUB_EVENTS_QUEUE_NAME") ||
    DEFAULT_GITHUB_EVENTS_QUEUE_NAME

  const connection: ConnectionOptions = {
    host: parsed.host,
    port: parsed.port,
    username: parsed.username,
    password: parsed.password,
    db: parsed.db,
    maxRetriesPerRequest: null,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  }

  return {
    redisConnectionLabel: `${parsed.protocol}//${parsed.host}:${parsed.port}/${parsed.db}`,
    connection,
    prefix,
    githubEventsQueueName,
  }
}

// ── Shared Helpers ───────────────────────────────────────────────────────────
// Use these in job modules instead of per-file getRedisConnection().

/**
 * Returns the Redis connection options for BullMQ.
 * Prefer getQueue() for producer-side usage.
 */
export const getRedisConnection = (): ConnectionOptions => {
  return getQueueRuntimeConfig().connection
}

const queueCache = new Map<string, Queue>()

/**
 * Returns a cached BullMQ Queue instance for the given name.
 * Uses the shared Redis connection from QUEUE_PREFIX / REDIS_URL.
 *
 * Usage in job modules:
 *   const queue = getQueue(QUEUE_NAME)
 *   await queue.add(JOB_NAME, data, opts)
 */
export const getQueue = <T = unknown>(name: string): Queue<T> => {
  const existing = queueCache.get(name)
  if (existing) {
    return existing as Queue<T>
  }

  const { connection, prefix } = getQueueRuntimeConfig()
  const queue = new Queue<T>(name, { connection, prefix })
  queueCache.set(name, queue)
  return queue
}

/**
 * Close all cached queues. Call during graceful shutdown.
 */
export const closeAllQueues = async (): Promise<void> => {
  await Promise.all([...queueCache.values()].map((q) => q.close()))
  queueCache.clear()
}
