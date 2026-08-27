#!/usr/bin/env bun

/**
 * Quota Reconciliation Worker
 *
 * Processes pending quota reconciliation jobs that were enqueued when
 * quota deduction failed for a message that was already sent.
 *
 * Usage: bun scripts/quota-reconciliation-worker.ts
 *
 * Environment variables:
 * - REDIS_URL: Redis connection URL (required)
 */

import { Worker } from "bullmq"
import { logger } from "@/lib/logger"
import {
  getQuotaReconciliationRedisConnection,
  QUOTA_RECONCILIATION_QUEUE,
} from "@/lib/queue/quota-reconciliation"
import type { QuotaReconciliationJobData } from "@/lib/queue/quota-reconciliation"
import { prisma } from "@/lib/prisma"
const CONCURRENCY = 4

async function processQuotaReconciliation(job: {
  id?: string
  data: QuotaReconciliationJobData
}): Promise<void> {
  const { organizationId, deviceId, direction, messageId, timestamp } = job.data

  logger.info(
    {
      event: "quota_reconciliation.processing_job",
      jobId: job.id,
      organizationId,
      deviceId,
      direction,
    },
    `[QuotaReconciliation] Processing job ${job.id} for org=${organizationId} device=${deviceId} direction=${direction}`
  )

  try {
    // Get the device to find its organization
    const device = await prisma.whatsappDevice.findFirst({
      where: { id: deviceId },
      select: { id: true, organizationId: true },
    })

    if (!device) {
      logger.error(
        {
          event: "quota_reconciliation.device_not_found",
          jobId: job.id,
          deviceId,
        },
        `[QuotaReconciliation] Device not found: deviceId=${deviceId}`
      )
      return // Don't retry - no device means nothing to reconcile
    }

    // Get date info for count records
    const jobDate = new Date(timestamp)
    const dateStr = new Date(jobDate.toISOString().split("T")[0])
    const year = jobDate.getUTCFullYear()
    const month = jobDate.getUTCMonth() + 1

    // Atomic upsert for daily count using organizationId
    await prisma.whatsappDailyCount.upsert({
      where: {
        organizationId_date_whatsappDeviceId: {
          organizationId,
          whatsappDeviceId: deviceId,
          date: dateStr,
        },
      },
      create: {
        organizationId,
        whatsappDeviceId: deviceId,
        date: dateStr,
        messageInboxCount: direction === "IN" ? 1 : 0,
        messageOutboxCount: direction === "OUT" ? 1 : 0,
      },
      update: {
        messageInboxCount: direction === "IN" ? { increment: 1 } : undefined,
        messageOutboxCount: direction === "OUT" ? { increment: 1 } : undefined,
      },
    })

    // Atomic upsert for monthly count using organizationId
    await prisma.whatsappMonthlyCount.upsert({
      where: {
        organizationId_year_month_whatsappDeviceId: {
          organizationId,
          whatsappDeviceId: deviceId,
          year,
          month,
        },
      },
      create: {
        organizationId,
        whatsappDeviceId: deviceId,
        year,
        month,
        messageInboxCount: direction === "IN" ? 1 : 0,
        messageOutboxCount: direction === "OUT" ? 1 : 0,
      },
      update: {
        messageInboxCount: direction === "IN" ? { increment: 1 } : undefined,
        messageOutboxCount: direction === "OUT" ? { increment: 1 } : undefined,
      },
    })

    // Update message metadata to clear quotaPending flag
    const message = await prisma.whatsappMessage.findFirst({
      where: { id: messageId },
    })

    if (message?.metadata) {
      const metadata =
        typeof message.metadata === "object"
          ? (message.metadata as Record<string, unknown>)
          : {}

      await prisma.whatsappMessage.update({
        where: { id: messageId },
        data: {
          metadata: {
            ...metadata,
            quotaPending: false,
            quotaReconciledAt: new Date().toISOString(),
          },
        },
      })
    }

    logger.info(
      {
        event: "quota_reconciliation.reconciled",
        jobId: job.id,
        messageId,
        organizationId,
        deviceId,
      },
      `[QuotaReconciliation] Successfully reconciled quota for job=${job.id} messageId=${messageId}`
    )
  } catch (error) {
    logger.error(
      {
        err: error,
        event: "quota_reconciliation.job_error",
        jobId: job.id,
        messageId,
        organizationId,
        deviceId,
      },
      `[QuotaReconciliation] Error processing job ${job.id}:`
    )
    throw error // Re-throw to trigger retry
  }
}

async function main() {
  logger.info(
    { event: "quota_reconciliation.worker_starting" },
    "[QuotaReconciliation] Worker starting..."
  )

  const connection = getQuotaReconciliationRedisConnection()

  const worker = new Worker<QuotaReconciliationJobData>(
    QUOTA_RECONCILIATION_QUEUE,
    async (job) => {
      await processQuotaReconciliation(
        job as unknown as { id?: string; data: QuotaReconciliationJobData }
      )
    },
    {
      connection,
      concurrency: CONCURRENCY,
    }
  )

  worker.on("completed", (job) => {
    if (job.id) {
      logger.info(
        {
          event: "quota_reconciliation.job_completed",
          jobId: job.id,
          jobName: job.name,
        },
        `[QuotaReconciliation] Job ${job.id} completed`
      )
    }
  })

  worker.on("failed", (job, error) => {
    if (job?.id) {
      logger.error(
        {
          err: error,
          event: "quota_reconciliation.job_failed",
          jobId: job.id,
          jobName: job.name,
        },
        `[QuotaReconciliation] Job ${job.id} failed:`
      )
    }
  })

  worker.on("error", (error) => {
    logger.error(
      { err: error, event: "quota_reconciliation.worker_error" },
      "[QuotaReconciliation] Worker error:"
    )
  })

  // Graceful shutdown
  const shutdown = async () => {
    logger.info(
      { event: "quota_reconciliation.shutting_down" },
      "[QuotaReconciliation] Shutting down..."
    )
    await worker.close()
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)

  logger.info(
    { event: "quota_reconciliation.worker_running", concurrency: CONCURRENCY },
    `[QuotaReconciliation] Worker running with concurrency=${CONCURRENCY}`
  )
}

main().catch((error) => {
  logger.error(
    { err: error, event: "quota_reconciliation.fatal_error" },
    "[QuotaReconciliation] Fatal error:"
  )
  process.exit(1)
})
