import { Queue, type JobsOptions, type RedisOptions } from "bullmq"
import { getQueue, getQueueRuntimeConfig } from "@/lib/queue/queue-config"

export const WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME = "whatsapp-template-sync"
export const WHATSAPP_TEMPLATE_SYNC_JOB_NAME = "sync-templates"

export type WhatsAppTemplateSyncJobData = {
  organizationId: string
  deviceId: string
  method: "sync-templates" | "sync-status"
}

export type WhatsAppTemplateSyncQueue = {
  enqueue: (
    data: WhatsAppTemplateSyncJobData,
    opts?: JobsOptions
  ) => Promise<void>
  close: () => Promise<void>
}

type QueueAddOnly = {
  add: (
    name: string,
    data: WhatsAppTemplateSyncJobData,
    opts?: JobsOptions
  ) => Promise<unknown>
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000,
  },
  removeOnComplete: 500,
  removeOnFail: 500,
}

const createTemplateSyncJobId = (data: WhatsAppTemplateSyncJobData): string => {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  return `wa-template-sync_${data.organizationId}_${data.deviceId}_${data.method}_${unique}`
}

export const getWhatsAppTemplateSyncRedisConnection = (): RedisOptions => {
  return getQueueRuntimeConfig().connection as RedisOptions
}

export const createWhatsAppTemplateSyncQueue = ({
  queue,
  queueName = WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
  jobName = WHATSAPP_TEMPLATE_SYNC_JOB_NAME,
  defaultJobOptions = DEFAULT_JOB_OPTIONS,
}: {
  queue?: QueueAddOnly
  queueName?: string
  jobName?: string
  defaultJobOptions?: JobsOptions
} = {}): WhatsAppTemplateSyncQueue => {
  const managedQueue = queue
  const ownedQueue = managedQueue
    ? null
    : new Queue<WhatsAppTemplateSyncJobData>(queueName, {
        connection: getWhatsAppTemplateSyncRedisConnection(),
        prefix: getQueueRuntimeConfig().prefix,
        defaultJobOptions,
      })
  const queueClient: QueueAddOnly =
    managedQueue ?? (ownedQueue as Queue<WhatsAppTemplateSyncJobData>)

  return {
    async enqueue(data, opts) {
      await queueClient.add(jobName, data, {
        jobId: createTemplateSyncJobId(data),
        ...opts,
      })
    },
    async close() {
      if (ownedQueue) {
        await ownedQueue.close()
      }
    },
  }
}

/**
 * Enqueue a template sync job (scheduled cron or manual trigger).
 */
export const enqueueWhatsAppTemplateSync = async (
  organizationId: string,
  deviceId: string,
  method: WhatsAppTemplateSyncJobData["method"] = "sync-templates"
) => {
  const queue = getQueue<WhatsAppTemplateSyncJobData>(
    WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME
  )

  await queue.add(
    WHATSAPP_TEMPLATE_SYNC_JOB_NAME,
    { organizationId, deviceId, method },
    {
      ...DEFAULT_JOB_OPTIONS,
      jobId: createTemplateSyncJobId({ organizationId, deviceId, method }),
    }
  )
}

export const __testing = {
  async resetQueueCache() {
    const { closeAllQueues } = await import("@/lib/queue/queue-config")
    await closeAllQueues()
  },
}
