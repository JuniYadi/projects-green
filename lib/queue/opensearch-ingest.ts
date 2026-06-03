import { Queue } from "bullmq"
import { getQueueRuntimeConfig } from "./queue-config"
import type { LogEntry } from "@/modules/deploy/opensearch"

export const OPENSEARCH_INGEST_QUEUE = "opensearch-ingest"

const { connection: redisConnection } = getQueueRuntimeConfig()

export const opensearchIngestQueue = new Queue<LogEntry>(
  OPENSEARCH_INGEST_QUEUE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    },
  }
)

export async function enqueueLogEntry(entry: LogEntry): Promise<void> {
  await opensearchIngestQueue.add("ingest", entry, {
    jobId: `${entry.tenantSlug}-${entry.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
  })
}

export async function enqueueLogBatch(
  entries: LogEntry[]
): Promise<void> {
  const jobs = entries.map((entry) => ({
    name: "ingest",
    data: entry,
    opts: {
      jobId: `${entry.tenantSlug}-${entry.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    },
  }))
  await opensearchIngestQueue.addBulk(jobs)
}
