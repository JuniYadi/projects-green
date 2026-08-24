import { cronMatches } from "@/lib/cron/cron-matcher"
import { syncCronJobDefinitions } from "@/lib/cron/registry"
import { withCronTelemetry } from "@/lib/cron/telemetry"
import { getQueue } from "@/lib/queue/queue-config"
import {
  BILLING_DAILY_RESET_QUEUE,
  BILLING_DAILY_RESET_JOB,
  BILLING_MONTHLY_RESET_QUEUE,
  BILLING_MONTHLY_RESET_JOB,
  BILLING_MONTHLY_BILLING_JOB,
  BILLING_INVOICE_STATUS_QUEUE,
  BILLING_INVOICE_STATUS_JOB,
  BILLING_PAYMENT_REMINDER_QUEUE,
  BILLING_PAYMENT_REMINDER_JOB,
  BILLING_RENEWAL_LADDER_QUEUE,
  BILLING_RENEWAL_LADDER_JOB,
} from "@/lib/queue/billing-cron"
import { WhatsAppHealthJob } from "@/lib/queue/whatsapp-health"
export interface ScheduledJobDefinition {
  name: string
  queueName: string
  jobName: string
  expression: string // UTC Cron syntax
  buildJobId: (now: Date) => string
  payload?: Record<string, unknown>
}

// ── Registry of All Scheduled Operations ───────────────────────────────────
export const scheduledJobsRegistry: ScheduledJobDefinition[] = [
  // 1. Every Minute Tasks
  {
    name: "deploy-monitor",
    queueName: "deploy-monitor",
    jobName: "check-deploy-status",
    expression: "* * * * *",
    buildJobId: (d) =>
      `deploy-monitor-${d.toISOString().slice(0, 16).replaceAll(":", "-")}`,
  },
  // 2. Every 5 Minutes Tasks
  {
    name: "vpn-reconciliation",
    queueName: "vpn-reconciliation",
    jobName: "reconcile-vpn-servers",
    expression: "*/5 * * * *",
    buildJobId: (d) =>
      `vpn-recon-${d.toISOString().slice(0, 16).replaceAll(":", "-")}`,
  },
  {
    name: "vpn-stale-cleanup",
    queueName: "vpn-stale-cleanup",
    jobName: "cleanup-stale-sessions",
    expression: "*/5 * * * *",
    buildJobId: (d) =>
      `vpn-stale-${d.toISOString().slice(0, 16).replaceAll(":", "-")}`,
  },
  {
    name: "whatsapp-health-fanout",
    queueName: WhatsAppHealthJob.queue,
    jobName: WhatsAppHealthJob.jobName,
    expression: "*/5 * * * *",
    buildJobId: (d) =>
      `wa-health-${d.toISOString().slice(0, 16).replaceAll(":", "-")}`,
    payload: { cycle: true },
  },
  // 3. Every 15 Minutes Tasks
  {
    name: "vpn-server-health",
    queueName: "vpn-server-health",
    jobName: "check-server-health",
    expression: "*/15 * * * *",
    buildJobId: (d) =>
      `vpn-health-${d.toISOString().slice(0, 16).replaceAll(":", "-")}`,
  },
  // 4. Hourly Tasks (Minute 0)
  {
    name: "whatsapp-hourly-billing",
    queueName: "whatsapp-billing",
    jobName: "process-hourly-billing",
    expression: "0 * * * *",
    buildJobId: (d) => `wa-billing-${d.toISOString().slice(0, 13)}`,
  },
  {
    name: "whatsapp-analytics-sync",
    queueName: "whatsapp-analytics",
    jobName: "sync-analytics",
    expression: "0 * * * *",
    buildJobId: (d) => `wa-analytics-${d.toISOString().slice(0, 13)}`,
  },
  {
    name: "app-hosting-billing",
    queueName: "app-hosting-billing",
    jobName: "process-payg-billing",
    expression: "0 * * * *",
    buildJobId: (d) => `app-billing-${d.toISOString().slice(0, 13)}`,
  },
  {
    name: "vpn-renewal",
    queueName: "vpn-renewal",
    jobName: "process-vpn-renewals",
    expression: "0 * * * *",
    buildJobId: (d) => `vpn-renewal-${d.toISOString().slice(0, 13)}`,
  },
  // 5. Daily Tasks (UTC)
  {
    name: "daily-count-cleanup",
    queueName: BILLING_DAILY_RESET_QUEUE,
    jobName: BILLING_DAILY_RESET_JOB,
    expression: "0 0 * * *",
    buildJobId: (d) => `daily-cleanup-${d.toISOString().slice(0, 10)}`,
  },
  {
    name: "invoice-status-transitions",
    queueName: BILLING_INVOICE_STATUS_QUEUE,
    jobName: BILLING_INVOICE_STATUS_JOB,
    expression: "0 2 * * *",
    buildJobId: (d) => `invoice-status-${d.toISOString().slice(0, 10)}`,
  },
  {
    name: "renewal-ladder-transitions",
    queueName: BILLING_RENEWAL_LADDER_QUEUE,
    jobName: BILLING_RENEWAL_LADDER_JOB,
    expression: "0 4 * * *",
    buildJobId: (d) => `renewal-ladder-${d.toISOString().slice(0, 10)}`,
  },
  {
    name: "payment-reminders",
    queueName: BILLING_PAYMENT_REMINDER_QUEUE,
    jobName: BILLING_PAYMENT_REMINDER_JOB,
    expression: "0 9 * * *",
    buildJobId: (d) => `payment-reminders-${d.toISOString().slice(0, 10)}`,
  },
  // 6. Monthly Tasks (1st of month at 00:00 and 03:00 UTC)
  {
    name: "monthly-count-cleanup",
    queueName: BILLING_MONTHLY_RESET_QUEUE,
    jobName: BILLING_MONTHLY_RESET_JOB,
    expression: "0 0 1 * *",
    buildJobId: (d) => `monthly-cleanup-${d.toISOString().slice(0, 7)}`,
  },
  {
    name: "monthly-billing-finalization",
    queueName: BILLING_MONTHLY_RESET_QUEUE,
    jobName: BILLING_MONTHLY_BILLING_JOB,
    expression: "0 3 1 * *",
    buildJobId: (d) => `monthly-billing-${d.toISOString().slice(0, 7)}`,
  },
]

export const dispatchScheduledJobs = async (
  now = new Date()
): Promise<{
  dispatched: string[]
  failed: { name: string; error: string }[]
}> => {
  const dueJobs = scheduledJobsRegistry.filter((job) =>
    cronMatches(job.expression, now)
  )

  if (dueJobs.length === 0) {
    return { dispatched: [], failed: [] }
  }

  const dispatched: string[] = []
  const failed: { name: string; error: string }[] = []
  await Promise.all(
    dueJobs.map(async (def) => {
      const queue = getQueue(def.queueName)
      const jobId = def.buildJobId(now)

      try {
        await withCronTelemetry(def.name, async (ctx) => {
          ctx.log(
            `Dispatching job ${def.jobName} to queue ${def.queueName} with ID ${jobId}`
          )
          await queue.add(
            def.jobName,
            { ...(def.payload || {}), scheduledAt: now.toISOString() },
            {
              jobId,
              removeOnComplete: 1000,
              removeOnFail: 5000,
            }
          )
          return { queue: def.queueName, jobName: def.jobName, jobId }
        })
        dispatched.push(def.name)
      } catch (err) {
        failed.push({
          name: def.name,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })
  )

  return { dispatched, failed }
}
if (import.meta.main) {
  await syncCronJobDefinitions().catch((e) =>
    console.warn("[schedule-runner] Failed to sync cron definitions:", e)
  )
  const now = new Date()
  const result = await dispatchScheduledJobs(now)

  if (result.dispatched.length > 0 || result.failed.length > 0) {
    console.info(
      JSON.stringify({
        level: "info",
        event: "schedule.tick",
        timestamp: now.toISOString(),
        dispatchedCount: result.dispatched.length,
        dispatched: result.dispatched,
        failedCount: result.failed.length,
        failed: result.failed,
      })
    )
  }

  process.exit(result.failed.length > 0 ? 1 : 0)
}
