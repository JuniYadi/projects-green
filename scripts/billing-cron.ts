import { Worker, type Job } from "bullmq"

import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import {
  BILLING_DAILY_RESET_JOB,
  BILLING_MONTHLY_RESET_JOB,
  BILLING_MONTHLY_BILLING_JOB,
  BILLING_INVOICE_STATUS_JOB,
  BILLING_PAYMENT_REMINDER_JOB,
  BILLING_RENEWAL_LADDER_JOB,
  BILLING_DAILY_RESET_QUEUE,
  BILLING_MONTHLY_RESET_QUEUE,
  BILLING_INVOICE_STATUS_QUEUE,
  BILLING_PAYMENT_REMINDER_QUEUE,
  BILLING_RENEWAL_LADDER_QUEUE,
  type BillingCronJobData,
} from "@/lib/queue/billing-cron"
import { getRedisConnection } from "@/lib/queue/queue-config"
import { UsageLedgerService } from "@/modules/billing/usage-ledger.service"
import { BillingCycleService } from "@/modules/billing/billing-cycle.service"
import { InvoiceStatusManager } from "@/modules/billing/invoice-status.service"
import { RenewalCoordinatorService } from "@/modules/billing/renewal/renewal-coordinator.service"
import { createVpnRenewalCallbacks } from "@/modules/vpn/billing/vpn-renewal-callbacks"
import { invoiceEmailService } from "@/modules/invoices/email.service"
const redisConnection = getRedisConnection()

/**
 * Daily reset: cleanup old WhatsAppDailyCount rows (> 90 days old).
 */
async function processDailyReset(): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const result = await prisma.whatsappDailyCount.deleteMany({
    where: {
      date: { lt: cutoff },
    },
  })

  return result.count
}

/**
 * Monthly reset: cleanup old WhatsAppMonthlyCount rows (> 12 months old).
 */
async function processMonthlyReset(): Promise<number> {
  const now = new Date()
  const cutoffYear = now.getUTCFullYear()
  const cutoffMonth = now.getUTCMonth() + 1

  // Calculate 13 months ago: keep rows from the same month one year ago onwards
  const targetYear = cutoffYear - 1
  const targetMonth = cutoffMonth

  const result = await prisma.whatsappMonthlyCount.deleteMany({
    where: {
      OR: [
        { year: { lt: targetYear } },
        {
          year: targetYear,
          month: { lt: targetMonth },
        },
      ],
    },
  })

  return result.count
}

/**
 * Monthly billing: run billing cycle orchestrator for all active subscriptions.
 */
async function processMonthlyBilling(): Promise<{
  processed: number
  skipped: number
}> {
  const usageLedger = new UsageLedgerService(prisma)
  const billingCycle = new BillingCycleService(
    prisma,
    usageLedger,
    invoiceEmailService
  )
  const finalized = await billingCycle.finalizeServiceInvoices()
  const result = await billingCycle.processMonthlyBilling()

  logger.info(
    {
      event: "billing_cron.monthly_billing_processed",
      finalized: finalized.finalized,
      processed: result.processed,
      skipped: result.skipped,
      invoicesCount: result.invoices.length,
    },
    `[billing-cron] monthly billing: finalized=${finalized.finalized} processed=${result.processed} skipped=${result.skipped} invoices=${result.invoices.length}`
  )

  return { processed: result.processed, skipped: result.skipped }
}

/**
 * Invoice status manager: run daily transitions (DRAFT→ISSUED, ISSUED→OVERDUE).
 */
async function processInvoiceStatusManager(): Promise<{
  issued: number
  overdue: number
}> {
  const statusManager = new InvoiceStatusManager(prisma, invoiceEmailService)
  const result = await statusManager.runDailyTransitions()

  logger.info(
    {
      event: "billing_cron.invoice_status_transitions_run",
      issued: result.issued,
      overdue: result.overdue,
    },
    `[billing-cron] invoice status manager: issued=${result.issued} overdue=${result.overdue}`
  )

  return result
}

/**
 * Payment reminder: send reminder emails exactly 3 and 1 days before due.
 */
async function processPaymentReminder(): Promise<{ sent: number }> {
  const statusManager = new InvoiceStatusManager(prisma, invoiceEmailService)
  const result = await statusManager.sendPaymentReminders()

  logger.info(
    {
      event: "billing_cron.payment_reminders_sent",
      sent: result.sent,
    },
    `[billing-cron] payment reminder: sent=${result.sent}`
  )

  return result
}

/**
 * Daily renewal ladder: suspend one day after due, terminate seven days
 * after due, per PRD - Global Subscription and Voucher System.
 */
async function processRenewalLadder(): Promise<number> {
  const coordinator = new RenewalCoordinatorService(prisma, {
    VPN: createVpnRenewalCallbacks(prisma),
  })
  const result = await coordinator.runLadderTransitions()
  return result.suspended + result.terminated
}

const worker = new Worker<BillingCronJobData>(
  BILLING_DAILY_RESET_QUEUE,
  async (job: Job<BillingCronJobData>) => {
    if (job.name === BILLING_DAILY_RESET_JOB) {
      const deleted = await processDailyReset()
      logger.info(
        {
          event: "billing_cron.daily_reset_completed",
          jobId: job.id,
          jobName: job.name,
          deletedCount: deleted,
        },
        `[billing-cron] daily reset: deleted ${deleted} old daily count rows`
      )
    } else if (job.name === BILLING_MONTHLY_RESET_JOB) {
      const deleted = await processMonthlyReset()
      logger.info(
        {
          event: "billing_cron.monthly_reset_completed",
          jobId: job.id,
          jobName: job.name,
          deletedCount: deleted,
        },
        `[billing-cron] monthly reset: deleted ${deleted} old monthly count rows`
      )
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
)

// Also listen on the monthly queue
const monthlyWorker = new Worker<BillingCronJobData>(
  BILLING_MONTHLY_RESET_QUEUE,
  async (job: Job<BillingCronJobData>) => {
    if (job.name === BILLING_MONTHLY_RESET_JOB) {
      const deleted = await processMonthlyReset()
      logger.info(
        {
          event: "billing_cron.monthly_reset_completed",
          jobId: job.id,
          jobName: job.name,
          deletedCount: deleted,
        },
        `[billing-cron] monthly reset: deleted ${deleted} old monthly count rows`
      )
    } else if (job.name === BILLING_MONTHLY_BILLING_JOB) {
      const result = await processMonthlyBilling()
      logger.info(
        {
          event: "billing_cron.monthly_billing_completed",
          jobId: job.id,
          jobName: job.name,
          processed: result.processed,
          skipped: result.skipped,
        },
        `[billing-cron] monthly billing: ${result.processed} processed`
      )
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
)

// Invoice status manager worker
const statusWorker = new Worker<BillingCronJobData>(
  BILLING_INVOICE_STATUS_QUEUE,
  async (job: Job<BillingCronJobData>) => {
    if (job.name === BILLING_INVOICE_STATUS_JOB) {
      const result = await processInvoiceStatusManager()
      logger.info(
        {
          event: "billing_cron.invoice_status_completed",
          jobId: job.id,
          jobName: job.name,
          issued: result.issued,
          overdue: result.overdue,
        },
        `[billing-cron] invoice status: ${result.issued} issued, ${result.overdue} overdue`
      )
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
)

// Payment reminder worker
const reminderWorker = new Worker<BillingCronJobData>(
  BILLING_PAYMENT_REMINDER_QUEUE,
  async (job: Job<BillingCronJobData>) => {
    if (job.name === BILLING_PAYMENT_REMINDER_JOB) {
      const result = await processPaymentReminder()
      logger.info(
        {
          event: "billing_cron.payment_reminder_completed",
          jobId: job.id,
          jobName: job.name,
          sent: result.sent,
        },
        `[billing-cron] payment reminder: sent=${result.sent}`
      )
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
)

// Renewal ladder worker
const renewalLadderWorker = new Worker<BillingCronJobData>(
  BILLING_RENEWAL_LADDER_QUEUE,
  async (job: Job<BillingCronJobData>) => {
    if (job.name === BILLING_RENEWAL_LADDER_JOB) {
      const transitioned = await processRenewalLadder()
      logger.info(
        {
          event: "billing_cron.renewal_ladder_completed",
          jobId: job.id,
          jobName: job.name,
          transitioned,
        },
        `[billing-cron] renewal ladder: ${transitioned} transitioned`
      )
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
)

worker.on("active", (job) => {
  logger.info(
    {
      event: "billing_cron.job_active",
      queue: "daily_reset",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] processing ${job.name} id=${job.id}`
  )
})

worker.on("completed", (job) => {
  logger.info(
    {
      event: "billing_cron.job_completed",
      queue: "daily_reset",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] completed ${job.name} id=${job.id}`
  )
})

worker.on("failed", (job, error) => {
  if (!job) {
    logger.error(
      { err: error, event: "billing_cron.job_failed", queue: "daily_reset" },
      "[billing-cron] failed job missing payload"
    )
    return
  }

  logger.error(
    {
      err: error,
      event: "billing_cron.job_failed",
      queue: "daily_reset",
      jobName: job.name,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    },
    `[billing-cron] failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`
  )
})

monthlyWorker.on("active", (job) => {
  logger.info(
    {
      event: "billing_cron.job_active",
      queue: "monthly_reset",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] processing ${job.name} id=${job.id}`
  )
})

monthlyWorker.on("completed", (job) => {
  logger.info(
    {
      event: "billing_cron.job_completed",
      queue: "monthly_reset",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] completed ${job.name} id=${job.id}`
  )
})

monthlyWorker.on("failed", (job, error) => {
  if (!job) {
    logger.error(
      { err: error, event: "billing_cron.job_failed", queue: "monthly_reset" },
      "[billing-cron] monthly failed job missing payload"
    )
    return
  }

  logger.error(
    {
      err: error,
      event: "billing_cron.job_failed",
      queue: "monthly_reset",
      jobName: job.name,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    },
    `[billing-cron] monthly failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`
  )
})

statusWorker.on("active", (job) => {
  logger.info(
    {
      event: "billing_cron.job_active",
      queue: "invoice_status",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] processing ${job.name} id=${job.id}`
  )
})

statusWorker.on("completed", (job) => {
  logger.info(
    {
      event: "billing_cron.job_completed",
      queue: "invoice_status",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] completed ${job.name} id=${job.id}`
  )
})

statusWorker.on("failed", (job, error) => {
  if (!job) {
    logger.error(
      { err: error, event: "billing_cron.job_failed", queue: "invoice_status" },
      "[billing-cron] status worker failed job missing payload"
    )
    return
  }

  logger.error(
    {
      err: error,
      event: "billing_cron.job_failed",
      queue: "invoice_status",
      jobName: job.name,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    },
    `[billing-cron] status worker failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`
  )
})

reminderWorker.on("active", (job) => {
  logger.info(
    {
      event: "billing_cron.job_active",
      queue: "payment_reminder",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] processing ${job.name} id=${job.id}`
  )
})

reminderWorker.on("completed", (job) => {
  logger.info(
    {
      event: "billing_cron.job_completed",
      queue: "payment_reminder",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] completed ${job.name} id=${job.id}`
  )
})

reminderWorker.on("failed", (job, error) => {
  if (!job) {
    logger.error(
      {
        err: error,
        event: "billing_cron.job_failed",
        queue: "payment_reminder",
      },
      "[billing-cron] reminder worker failed job missing payload"
    )
    return
  }

  logger.error(
    {
      err: error,
      event: "billing_cron.job_failed",
      queue: "payment_reminder",
      jobName: job.name,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    },
    `[billing-cron] reminder worker failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`
  )
})

renewalLadderWorker.on("active", (job) => {
  logger.info(
    {
      event: "billing_cron.job_active",
      queue: "renewal_ladder",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] processing ${job.name} id=${job.id}`
  )
})

renewalLadderWorker.on("completed", (job) => {
  logger.info(
    {
      event: "billing_cron.job_completed",
      queue: "renewal_ladder",
      jobName: job.name,
      jobId: job.id,
    },
    `[billing-cron] completed ${job.name} id=${job.id}`
  )
})

renewalLadderWorker.on("failed", (job, error) => {
  if (!job) {
    logger.error(
      {
        err: error,
        event: "billing_cron.job_failed",
        queue: "renewal_ladder",
      },
      "[billing-cron] renewal ladder worker failed job missing payload"
    )
    return
  }

  logger.error(
    {
      err: error,
      event: "billing_cron.job_failed",
      queue: "renewal_ladder",
      jobName: job.name,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
    },
    `[billing-cron] renewal ladder worker failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`
  )
})

// Register repeatable jobs on startup
export async function registerRepeatableJobs() {
  const { Queue } = await import("bullmq")

  // Daily: every day at 00:00 UTC
  const dailyQueue = new Queue(BILLING_DAILY_RESET_QUEUE, {
    connection: redisConnection,
  })
  await dailyQueue.add(
    BILLING_DAILY_RESET_JOB,
    {},
    {
      repeat: { pattern: "0 0 * * *" },
      jobId: "billing-daily-reset",
    }
  )

  // Monthly: 1st of each month at 02:00 UTC (after reset cleanup)
  const monthlyQueue = new Queue(BILLING_MONTHLY_RESET_QUEUE, {
    connection: redisConnection,
  })
  await monthlyQueue.add(
    BILLING_MONTHLY_RESET_JOB,
    {},
    {
      repeat: { pattern: "0 0 1 * *" },
      jobId: "billing-monthly-reset",
    }
  )

  // Monthly billing: 1st of each month at 03:00 UTC
  await monthlyQueue.add(
    BILLING_MONTHLY_BILLING_JOB,
    {},
    {
      repeat: { pattern: "0 3 1 * *" },
      jobId: "billing-monthly-billing",
    }
  )

  // Invoice status manager: daily at 02:00 UTC
  const statusQueue = new Queue(BILLING_INVOICE_STATUS_QUEUE, {
    connection: redisConnection,
  })
  await statusQueue.add(
    BILLING_INVOICE_STATUS_JOB,
    {},
    {
      repeat: { pattern: "0 2 * * *" },
      jobId: "billing-invoice-status",
    }
  )

  // Payment reminder: daily at 09:00 UTC
  const reminderQueue = new Queue(BILLING_PAYMENT_REMINDER_QUEUE, {
    connection: redisConnection,
  })
  await reminderQueue.add(
    BILLING_PAYMENT_REMINDER_JOB,
    {},
    {
      repeat: { pattern: "0 9 * * *" },
      jobId: "billing-payment-reminder",
    }
  )

  // Renewal ladder: daily at 04:00 UTC, after invoice status and billing
  const renewalLadderQueue = new Queue(BILLING_RENEWAL_LADDER_QUEUE, {
    connection: redisConnection,
  })
  await renewalLadderQueue.add(
    BILLING_RENEWAL_LADDER_JOB,
    {},
    {
      repeat: { pattern: "0 4 * * *" },
      jobId: "billing-renewal-ladder",
    }
  )

  await dailyQueue.close()
  await monthlyQueue.close()
  await statusQueue.close()
  await reminderQueue.close()
  await renewalLadderQueue.close()

  logger.info(
    { event: "billing_cron.repeatable_jobs_registered" },
    "[billing-cron] repeatable jobs registered"
  )
}

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info(
    { event: "billing_cron.shutting_down", signal },
    `[billing-cron] received ${signal}, shutting down`
  )

  try {
    await worker.close()
    await monthlyWorker.close()
    await statusWorker.close()
    await reminderWorker.close()
    await renewalLadderWorker.close()
    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    logger.error(
      { err: error, event: "billing_cron.shutdown_failed", signal },
      "[billing-cron] shutdown failed"
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

// Auto-register and start only when run as standalone entry point
if (import.meta.main) {
  void registerRepeatableJobs().then(() => {
    logger.info(
      {
        event: "billing_cron.ready",
        queues: [
          BILLING_DAILY_RESET_QUEUE,
          BILLING_MONTHLY_RESET_QUEUE,
          BILLING_INVOICE_STATUS_QUEUE,
          BILLING_PAYMENT_REMINDER_QUEUE,
          BILLING_RENEWAL_LADDER_QUEUE,
        ],
      },
      `[billing-cron] ready queues=${BILLING_DAILY_RESET_QUEUE},${BILLING_MONTHLY_RESET_QUEUE},${BILLING_INVOICE_STATUS_QUEUE},${BILLING_PAYMENT_REMINDER_QUEUE},${BILLING_RENEWAL_LADDER_QUEUE}`
    )
  })
}
