#!/usr/bin/env bun
/**
 * Unified Worker Process
 *
 * Runs ALL BullMQ workers and interval-based tasks in a single process.
 * One pod handles everything — simplifies deployment, reduces resource usage.
 *
 * Workers included:
 *   BullMQ (event-driven):
 *     - github-events (concurrency: 4)
 *     - billing-daily-reset (concurrency: 1)
 *     - billing-monthly-reset (concurrency: 1)
 *     - billing-invoice-status (concurrency: 1)
 *     - billing-payment-reminder (concurrency: 1)
 *     - opensearch-ingest (concurrency: 4)
 *     - quota-reconciliation (concurrency: 4)
 *     - whatsapp-broadcast (concurrency: 4)
 *     - whatsapp-template-sync (concurrency: 2)
 *
 *   Interval-based (cron-style):
 *     - deploy-monitor (every 60s)
 *     - app-hosting-billing (every hour)
 *     - whatsapp-monthly-billing (every hour)
 *     - vpn-renewal (every hour)
 *
 * Usage: bun run worker:all
 */

import { Worker, type Job } from "bullmq"
import { prisma } from "@/lib/prisma"
import {
  getRedisConnection,
  getQueueRuntimeConfig,
  closeAllQueues,
} from "@/lib/queue/queue-config"

// ── GitHub Events ──────────────────────────────────────────────────────────
import { GithubEventJob } from "@/modules/github/jobs/github-event.job"

// ── Billing Cron ───────────────────────────────────────────────────────────
import {
  BILLING_DAILY_RESET_QUEUE,
  BILLING_MONTHLY_RESET_QUEUE,
  BILLING_INVOICE_STATUS_QUEUE,
  BILLING_PAYMENT_REMINDER_QUEUE,
  BILLING_DAILY_RESET_JOB,
  BILLING_MONTHLY_RESET_JOB,
  BILLING_MONTHLY_BILLING_JOB,
  BILLING_INVOICE_STATUS_JOB,
  BILLING_PAYMENT_REMINDER_JOB,
  type BillingCronJobData,
} from "@/lib/queue/billing-cron"
import { registerRepeatableJobs } from "./billing-cron"
import { UsageLedgerService } from "@/modules/billing/usage-ledger.service"
import { BillingCycleService } from "@/modules/billing/billing-cycle.service"
import { InvoiceStatusManager } from "@/modules/billing/invoice-status.service"
import { invoiceEmailService } from "@/modules/invoices/email.service"

// ── OpenSearch Ingest ──────────────────────────────────────────────────────
import { OPENSEARCH_INGEST_QUEUE } from "@/lib/queue/opensearch-ingest"
import { ingestLog } from "@/modules/deploy/opensearch/opensearch-log.service"
import type { LogEntry } from "@/modules/deploy/opensearch"

// ── Quota Reconciliation ───────────────────────────────────────────────────
import {
  QUOTA_RECONCILIATION_QUEUE,
  type QuotaReconciliationJobData,
} from "@/lib/queue/quota-reconciliation"

// ── WhatsApp Broadcast ─────────────────────────────────────────────────────
import {
  WHATSAPP_BROADCAST_QUEUE_NAME,
  type WhatsAppBroadcastJobData,
} from "@/lib/queue/whatsapp-broadcast"

// ── WhatsApp Template Sync ─────────────────────────────────────────────────
import {
  WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
  type WhatsAppTemplateSyncJobData,
} from "@/lib/queue/whatsapp-template-sync"
import { processWhatsAppTemplateSyncJob } from "./whatsapp-template-sync-worker"

// ── WhatsApp Health ────────────────────────────────────────────────────────────
import { WhatsAppHealthJob } from "@/lib/queue/whatsapp-health"

// ── WhatsApp Outgoing Webhook ──────────────────────────────────────────────
import {
  WHATSAPP_WEBHOOK_OUTGOING_QUEUE,
  type WhatsappOutgoingWebhookJobData,
} from "@/lib/queue/whatsapp-webhook-outgoing"
import { processOutgoingWebhookJob } from "./whatsapp-webhook-outgoing-worker"

// ── WhatsApp Incoming Webhook Retry ────────────────────────────────────────
import { WebhookRetryJob } from "@/modules/whatsapp/webhooks/jobs/webhook-retry.job"

// ── Interval-based services ────────────────────────────────────────────────
import { monitorActiveDeployments } from "@/modules/deploy/deploy-monitor.service"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { AppHostingBillingService } from "@/modules/deploy/billing/app-hosting-billing.service"
import { WhatsappBillingService } from "@/modules/whatsapp/billing/whatsapp-billing.service"
import { VpnRenewalService } from "@/modules/vpn/billing/vpn-renewal.service"
import {
  VpnProvisioningJob,
  vpnStagedBackoff,
  type VpnProvisioningJobData,
} from "@/lib/queue/vpn-provisioning"
import { vpnProvisioningService } from "@/modules/vpn/provisioning/vpn-provisioning.service"
import { vpnReconciliationService } from "@/modules/vpn/provisioning/vpn-reconciliation.service"
import { vpnHealthService } from "@/modules/vpn/admin/vpn-health.service"
import { EmailJob } from "@/lib/queue/email"

// ══════════════════════════════════════════════════════════════════════════
// BullMQ Workers
// ══════════════════════════════════════════════════════════════════════════

const allWorkers: Worker[] = []

// ── Redis connection (shared across all workers) ────────────────────────────
const redisConnection = getRedisConnection()
const { prefix } = getQueueRuntimeConfig()

// ── GitHub Events Worker ────────────────────────────────────────────────────
allWorkers.push(GithubEventJob.createWorker())

// ── Billing Cron Workers ────────────────────────────────────────────────────

async function processDailyReset(): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const result = await prisma.whatsappDailyCount.deleteMany({
    where: { date: { lt: cutoff } },
  })

  return result.count
}

async function processMonthlyReset(): Promise<number> {
  const now = new Date()
  const cutoffYear = now.getUTCFullYear()
  const cutoffMonth = now.getUTCMonth() + 1
  const targetYear = cutoffYear - 1
  const targetMonth = cutoffMonth

  const result = await prisma.whatsappMonthlyCount.deleteMany({
    where: {
      OR: [
        { year: { lt: targetYear } },
        { year: targetYear, month: { lt: targetMonth } },
      ],
    },
  })

  return result.count
}

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

  console.info(
    `[billing-cron] monthly billing: finalized=${finalized.finalized} processed=${result.processed} skipped=${result.skipped} invoices=${result.invoices.length}`
  )

  return { processed: result.processed, skipped: result.skipped }
}

async function processInvoiceStatusManager(): Promise<{
  issued: number
  overdue: number
}> {
  const statusManager = new InvoiceStatusManager(prisma, invoiceEmailService)
  const result = await statusManager.runDailyTransitions()

  console.info(
    `[billing-cron] invoice status manager: issued=${result.issued} overdue=${result.overdue}`
  )

  return result
}

async function processPaymentReminder(): Promise<{ sent: number }> {
  const statusManager = new InvoiceStatusManager(prisma, invoiceEmailService)
  const result = await statusManager.sendPaymentReminders()

  console.info(`[billing-cron] payment reminder: sent=${result.sent}`)

  return result
}

const billingDailyWorker = new Worker<BillingCronJobData>(
  BILLING_DAILY_RESET_QUEUE,
  async (job: Job<BillingCronJobData>) => {
    if (job.name === BILLING_DAILY_RESET_JOB) {
      const deleted = await processDailyReset()
      console.info(
        `[billing-cron] daily reset: deleted ${deleted} old daily count rows`
      )
    } else if (job.name === BILLING_MONTHLY_RESET_JOB) {
      const deleted = await processMonthlyReset()
      console.info(
        `[billing-cron] monthly reset: deleted ${deleted} old monthly count rows`
      )
    }
  },
  { connection: redisConnection, prefix, concurrency: 1 }
)
allWorkers.push(billingDailyWorker)

const billingMonthlyWorker = new Worker<BillingCronJobData>(
  BILLING_MONTHLY_RESET_QUEUE,
  async (job: Job<BillingCronJobData>) => {
    if (job.name === BILLING_MONTHLY_RESET_JOB) {
      const deleted = await processMonthlyReset()
      console.info(
        `[billing-cron] monthly reset: deleted ${deleted} old monthly count rows`
      )
    } else if (job.name === BILLING_MONTHLY_BILLING_JOB) {
      await processMonthlyBilling()
    }
  },
  { connection: redisConnection, prefix, concurrency: 1 }
)
allWorkers.push(billingMonthlyWorker)

const billingStatusWorker = new Worker<BillingCronJobData>(
  BILLING_INVOICE_STATUS_QUEUE,
  async (job: Job<BillingCronJobData>) => {
    if (job.name === BILLING_INVOICE_STATUS_JOB) {
      await processInvoiceStatusManager()
    }
  },
  { connection: redisConnection, prefix, concurrency: 1 }
)
allWorkers.push(billingStatusWorker)

const billingReminderWorker = new Worker<BillingCronJobData>(
  BILLING_PAYMENT_REMINDER_QUEUE,
  async (job: Job<BillingCronJobData>) => {
    if (job.name === BILLING_PAYMENT_REMINDER_JOB) {
      await processPaymentReminder()
    }
  },
  { connection: redisConnection, prefix, concurrency: 1 }
)
allWorkers.push(billingReminderWorker)

// ── OpenSearch Ingest Worker ────────────────────────────────────────────────
const opensearchConcurrency = parseInt(
  process.env.WORKER_CONCURRENCY ?? "4",
  10
)

const opensearchWorker = new Worker<LogEntry>(
  OPENSEARCH_INGEST_QUEUE,
  async (job: Job<LogEntry>) => {
    const success = await ingestLog(job.data)
    if (!success) {
      throw new Error(
        `Failed to ingest log entry for tenant ${job.data.tenantSlug}`
      )
    }
    return { ingested: true }
  },
  { connection: redisConnection, prefix, concurrency: opensearchConcurrency }
)
allWorkers.push(opensearchWorker)

// ── Quota Reconciliation Worker ─────────────────────────────────────────────
const quotaWorker = new Worker<QuotaReconciliationJobData>(
  QUOTA_RECONCILIATION_QUEUE,
  async (job: Job<QuotaReconciliationJobData>) => {
    const { organizationId, deviceId, direction, messageId, timestamp } =
      job.data

    const device = await prisma.whatsappDevice.findFirst({
      where: { id: deviceId },
      select: { id: true, organizationId: true },
    })

    if (!device) {
      console.error(
        `[quota-reconciliation] Device not found: deviceId=${deviceId}`
      )
      return
    }

    const jobDate = new Date(timestamp)
    const dateStr = new Date(jobDate.toISOString().split("T")[0])
    const year = jobDate.getUTCFullYear()
    const month = jobDate.getUTCMonth() + 1

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
  },
  {
    connection: redisConnection,
    prefix,
    concurrency: 4,
  }
)
allWorkers.push(quotaWorker)

// ── WhatsApp Broadcast Worker ───────────────────────────────────────────────
const whatsappBroadcastWorker = new Worker<WhatsAppBroadcastJobData>(
  WHATSAPP_BROADCAST_QUEUE_NAME,
  async (job: Job<WhatsAppBroadcastJobData>) => {
    if (job.data.method === "dispatch") {
      console.info(
        `[whatsapp-broadcast] would dispatch campaign=${job.data.campaignId} recipient=${job.data.recipientId}`
      )
      return
    }

    if (job.data.method === "throttle") {
      console.info(
        `[whatsapp-broadcast] throttle campaign=${job.data.campaignId} recipient=${job.data.recipientId}`
      )
      return
    }

    if (job.data.method === "status-update") {
      console.info(
        `[whatsapp-broadcast] status-update campaign=${job.data.campaignId} recipient=${job.data.recipientId}`
      )
      return
    }
  },
  {
    connection: redisConnection,
    prefix,
    concurrency: 4,
  }
)
allWorkers.push(whatsappBroadcastWorker)

// ── WhatsApp Template Sync Worker ───────────────────────────────────────────
const whatsappTemplateSyncWorker = new Worker<WhatsAppTemplateSyncJobData>(
  WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME,
  processWhatsAppTemplateSyncJob,
  {
    connection: redisConnection,
    prefix,
    concurrency: 2,
  }
)
whatsappTemplateSyncWorker.on("completed", (job, summary) => {
  console.info(
    `[whatsapp-template-sync] completed ${job.name} id=${job.id} result=${JSON.stringify(summary ?? null)}`
  )
})
allWorkers.push(whatsappTemplateSyncWorker)

// ── VPN Server Sync Worker ──────────────────────────────────────────
import { VpnServerSyncJob } from "@/lib/queue/vpn-server-sync"

const vpnServerSyncWorker = VpnServerSyncJob.createWorker()
allWorkers.push(vpnServerSyncWorker)

// ── VPN Provisioning Worker ──────────────────────────────────────────
const vpnProvisioningWorker = new Worker<VpnProvisioningJobData>(
  VpnProvisioningJob.queue,
  async (job: Job<VpnProvisioningJobData>) => {
    await vpnProvisioningService.provisionAccount(job.data.serverAccountId)
  },
  {
    connection: redisConnection,
    prefix,
    concurrency: VpnProvisioningJob.workerConcurrency,
    settings: { backoffStrategy: vpnStagedBackoff },
  }
)
allWorkers.push(vpnProvisioningWorker)

// ── Email Queue Worker ──────────────────────────────────────────────
const emailWorker = EmailJob.createWorker()
allWorkers.push(emailWorker)

// ── WhatsApp Health Worker ──────────────────────────────────────────────
const whatsappHealthWorker = WhatsAppHealthJob.createWorker()
allWorkers.push(whatsappHealthWorker)

// ── WhatsApp Outgoing Webhook Worker ──────────────────────────────────────
const waOutgoingWorker = new Worker<WhatsappOutgoingWebhookJobData>(
  WHATSAPP_WEBHOOK_OUTGOING_QUEUE,
  processOutgoingWebhookJob,
  {
    connection: redisConnection,
    prefix,
    concurrency: 4,
  }
)
allWorkers.push(waOutgoingWorker)

// ── WhatsApp Incoming Webhook Retry Worker ─────────────────────────────────
const waWebhookRetryWorker = WebhookRetryJob.createWorker()
allWorkers.push(waWebhookRetryWorker)

// ── Event Logging (shared across all workers) ──────────────────────────────
for (const worker of allWorkers) {
  const name = worker.name

  worker.on("active", (job) => {
    console.info(`[${name}] active ${job.name} id=${job.id}`)
  })

  worker.on("completed", (job) => {
    console.info(`[${name}] completed ${job.name} id=${job.id}`)
  })

  worker.on("failed", (job, error) => {
    if (!job) {
      console.error(`[${name}] failed job missing payload`, error)
      return
    }
    console.error(
      `[${name}] failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`,
      error
    )
  })
}

// ══════════════════════════════════════════════════════════════════════════
// Interval-based Workers (cron-style)
// ══════════════════════════════════════════════════════════════════════════

const intervals: ReturnType<typeof setInterval>[] = []

// ── Deploy Monitor (every 60s) ──────────────────────────────────────────────
const deployMonitorInterval = setInterval(async () => {
  try {
    const results = await monitorActiveDeployments()
    if (results.length > 0) {
      console.info(
        `[deploy-monitor] checked ${results.length} active deployment(s)`
      )
    }
  } catch (error) {
    console.error("[deploy-monitor] monitor cycle failed:", error)
  }
}, 60_000)
intervals.push(deployMonitorInterval)

// ── App Hosting Billing (every hour) ────────────────────────────────────────
const appHostingBillingInterval = setInterval(async () => {
  try {
    const transactions = new BillingTransactionService(prisma)
    const billingService = new AppHostingBillingService(prisma, transactions)

    // Charge active PAYG stacks
    const stacks = await prisma.applicationStack.findMany({
      where: {
        billingMode: "PAYG",
        status: "RUNNING",
        hourlyCost: { not: null },
      },
    })

    let charged = 0
    let graceEntered = 0
    let errors = 0

    for (const stack of stacks) {
      try {
        const { Prisma } = await import("@prisma/client")
        const hourlyCost = new Prisma.Decimal(String(stack.hourlyCost))

        const result = await billingService.chargePaygRuntimeHour({
          organizationId: stack.organizationId,
          stackId: stack.id,
          hourlyCost,
          occurredAt: new Date(),
        })

        if (result.graceEntered) {
          graceEntered++
        } else if (!result.alreadyProcessed) {
          charged++
        }
      } catch (error) {
        errors++
        console.error(`[app-hosting-billing] stack=${stack.id} error:`, error)
      }
    }

    // Check grace suspension
    const graceStacks = await prisma.applicationStack.findMany({
      where: {
        metadataJson: { path: ["billingState"], equals: "PAYMENT_GRACE" },
      },
    })

    let suspended = 0
    for (const stack of graceStacks) {
      try {
        const result = await billingService.checkGraceAndSuspend({
          stackId: stack.id,
        })
        if (result.suspended) suspended++
      } catch (error) {
        console.error(
          `[app-hosting-billing] grace check stack=${stack.id} error:`,
          error
        )
      }
    }

    console.info(
      `[app-hosting-billing] charged=${charged} grace=${graceEntered} suspended=${suspended} errors=${errors}`
    )
  } catch (error) {
    console.error("[app-hosting-billing] cycle failed:", error)
  }
}, 3_600_000) // 1 hour
intervals.push(appHostingBillingInterval)

// ── WhatsApp Monthly Billing (every hour) ───────────────────────────────────
const whatsappBillingInterval = setInterval(async () => {
  try {
    const transactions = new BillingTransactionService(prisma)
    const whatsappBilling = new WhatsappBillingService(prisma, transactions)

    const now = new Date()
    const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`

    const BATCH_SIZE = 100
    let charged = 0
    let skipped = 0
    let errors = 0
    let cursor: string | undefined

    while (true) {
      const devices = await prisma.whatsappDevice.findMany({
        where: { status: "ACTIVE" },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      })

      if (devices.length === 0) break

      const orgIds = [...new Set(devices.map((d) => d.organizationId))]
      const subscriptions = await prisma.serviceSubscription.findMany({
        where: {
          organizationId: { in: orgIds },
          package: { code: "WHATSAPP" },
          status: "ACTIVE",
        },
        include: { pricing: true, plan: true },
      })

      const subByOrg = new Map(subscriptions.map((s) => [s.organizationId, s]))

      for (const device of devices) {
        try {
          const subscription = subByOrg.get(device.organizationId)
          if (!subscription) {
            skipped++
            continue
          }

          const { Prisma } = await import("@prisma/client")
          const basePrice = new Prisma.Decimal(
            subscription.pricing.basePriceIdr.toString()
          )

          if (basePrice.lte(0)) {
            skipped++
            continue
          }

          await whatsappBilling.chargeMonthlyBase({
            organizationId: device.organizationId,
            deviceId: device.id,
            amount: basePrice,
            allowance: 0,
            period,
          })

          charged++
        } catch (error) {
          errors++
          console.error(`[whatsapp-billing] device=${device.id} error:`, error)
        }
      }

      cursor = devices[devices.length - 1].id
    }

    console.info(
      `[whatsapp-billing] charged=${charged} skipped=${skipped} errors=${errors} period=${period}`
    )
  } catch (error) {
    console.error("[whatsapp-billing] cycle failed:", error)
  }
}, 3_600_000) // 1 hour
intervals.push(whatsappBillingInterval)

// ── WhatsApp Analytics Sync (every hour) ────────────────────────────────────
const whatsappAnalyticsInterval = setInterval(async () => {
  try {
    const now = new Date()
    const endDate = now.toISOString().split("T")[0]
    const startDate = new Date(now.getTime() - 7 * 86400_000)
      .toISOString()
      .split("T")[0]

    const activeDevices = await prisma.whatsappDevice.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, organizationId: true },
    })

    let synced = 0
    let errors = 0

    for (const device of activeDevices) {
      try {
        const { analyticsService } = await import(
          "@/modules/whatsapp/analytics/analytics.service"
        )
        const result = await analyticsService.syncAnalytics({
          deviceId: device.id,
          organizationId: device.organizationId,
          startDate,
          endDate,
          granularity: "DAY",
        })
        synced += result.syncedCount
        if (result.discrepancies.length > 0) {
          console.warn(
            `[whatsapp-analytics] device=${device.id} discrepancies=${result.discrepancies.length}`
          )
        }
      } catch (error) {
        errors++
        console.error(
          `[whatsapp-analytics] device=${device.id} error:`,
          error
        )
      }
    }

    console.info(
      `[whatsapp-analytics] synced=${synced} errors=${errors} devices=${activeDevices.length}`
    )
  } catch (error) {
    console.error("[whatsapp-analytics] cycle failed:", error)
  }
}, 3_600_000) // 1 hour
intervals.push(whatsappAnalyticsInterval)

// ── VPN Renewal (every hour) ────────────────────────────────────────────────
const vpnRenewalInterval = setInterval(async () => {
  try {
    const transactions = new BillingTransactionService(prisma)
    const renewalService = new VpnRenewalService(prisma, transactions)

    const result = await renewalService.renewDueSubscriptions()

    console.info(
      `[vpn-renewal] renewed=${result.renewed} retried=${result.retried} suspended=${result.suspended} expired=${result.expired} errors=${result.errors}`
    )
  } catch (error) {
    console.error("[vpn-renewal] cycle failed:", error)
  }
}, 3_600_000) // 1 hour
intervals.push(vpnRenewalInterval)

// ── VPN Reconciliation (every 5 minutes) ─────────────────────────────────
const vpnReconciliationInterval = vpnReconciliationService.start()
intervals.push(vpnReconciliationInterval)

// ── VPN Health Checks (every 15 minutes) ──────────────────────────────────
const vpnHealthInterval = vpnHealthService.start()
intervals.push(vpnHealthInterval)

// ══════════════════════════════════════════════════════════════════════════
// Graceful Shutdown
// ══════════════════════════════════════════════════════════════════════════

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) return
  shuttingDown = true

  console.info(`[workers] received ${signal}, shutting down gracefully...`)

  // Stop all intervals
  for (const interval of intervals) {
    clearInterval(interval)
  }

  // Close all BullMQ workers (waits for active jobs to finish)
  await Promise.all(allWorkers.map((w) => w.close()))

  // Close cached producer queues
  await closeAllQueues()

  // Disconnect Prisma
  await prisma.$disconnect()

  console.info("[workers] shutdown complete")
  process.exit(0)
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))

// ══════════════════════════════════════════════════════════════════════════
// Startup
// ══════════════════════════════════════════════════════════════════════════

// Register billing repeatable jobs (idempotent — safe to call on every start)
await registerRepeatableJobs()

// Register WhatsApp health heartbeat (every 5 min)
await WhatsAppHealthJob.registerSchedule()

// Run deploy monitor immediately on startup
try {
  const results = await monitorActiveDeployments()
  if (results.length > 0) {
    console.info(
      `[deploy-monitor] initial check: ${results.length} active deployment(s)`
    )
  }
} catch (error) {
  console.error("[deploy-monitor] initial check failed:", error)
}

console.info("[workers] unified worker process ready")
console.info(
  `[workers] bullmq queues: ${GithubEventJob.queue}, ${BILLING_DAILY_RESET_QUEUE}, ${BILLING_MONTHLY_RESET_QUEUE}, ${BILLING_INVOICE_STATUS_QUEUE}, ${BILLING_PAYMENT_REMINDER_QUEUE}, ${OPENSEARCH_INGEST_QUEUE}, ${QUOTA_RECONCILIATION_QUEUE}, ${WHATSAPP_BROADCAST_QUEUE_NAME}, ${WHATSAPP_TEMPLATE_SYNC_QUEUE_NAME}, ${EmailJob.queue}, ${WHATSAPP_WEBHOOK_OUTGOING_QUEUE}`
)
console.info(
  "[workers] interval tasks: deploy-monitor (60s), app-hosting-billing (1h), whatsapp-billing (1h), vpn-renewal (1h), vpn-reconciliation (5m), vpn-health (15m)"
)
