import { Worker, Job } from "bullmq"
import { getQueueRuntimeConfig } from "../lib/queue/queue-config"
import { OPENSEARCH_INGEST_QUEUE } from "../lib/queue/opensearch-ingest"
import { ingestLog } from "../modules/deploy/opensearch/opensearch-log.service"
import type { LogEntry } from "../modules/deploy/opensearch"

const { connection: redisConnection } = getQueueRuntimeConfig()

const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? "4", 10)

const worker = new Worker<LogEntry>(
  OPENSEARCH_INGEST_QUEUE,
  async (job: Job<LogEntry>) => {
    const success = await ingestLog(job.data)
    if (!success) {
      throw new Error(`Failed to ingest log entry for tenant ${job.data.tenantSlug}`)
    }
    return { ingested: true }
  },
  {
    connection: redisConnection,
    concurrency,
  }
)

worker.on("active", (job) => {
  console.log(`[opensearch-ingest] Processing job ${job.id} for tenant ${job.data.tenantSlug}`)
})

worker.on("completed", (job) => {
  console.log(`[opensearch-ingest] Job ${job.id} completed`)
})

worker.on("failed", (job, err) => {
  console.error(`[opensearch-ingest] Job ${job?.id} failed:`, err.message)
})

worker.on("ready", () => {
  console.log(`[opensearch-ingest] Worker ready (concurrency: ${concurrency})`)
})

async function shutdown() {
  console.log("[opensearch-ingest] Shutting down...")
  await worker.close()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
