import { prisma } from "@/lib/prisma"
import type { CronJobDefinition } from "@prisma/client"

export interface CronDefinitionConfig {
  code: string
  name: string
  description?: string
  category: "billing" | "whatsapp" | "system" | "vpn" | "retention"
  cronExpression: string
  timezone?: string
  timeoutSeconds?: number
  gracePeriodMins?: number
}

export const CRON_JOB_DEFINITIONS: CronDefinitionConfig[] = [
  {
    code: "deploy-monitor",
    name: "Deploy Status Monitor",
    description:
      "Monitors app hosting deployment health and timeouts every minute",
    category: "system",
    cronExpression: "* * * * *",
    timeoutSeconds: 120,
    gracePeriodMins: 2,
  },
  {
    code: "vpn-reconciliation",
    name: "VPN Server Reconciliation",
    description: "Reconciles WireGuard / VPN state across active nodes",
    category: "vpn",
    cronExpression: "*/5 * * * *",
    timeoutSeconds: 300,
    gracePeriodMins: 5,
  },
  {
    code: "vpn-stale-cleanup",
    name: "VPN Stale Session Cleanup",
    description: "Cleans up expired and disconnected VPN sessions",
    category: "vpn",
    cronExpression: "*/5 * * * *",
    timeoutSeconds: 300,
    gracePeriodMins: 5,
  },
  {
    code: "whatsapp-health-fanout",
    name: "WhatsApp Device Health Fanout",
    description:
      "Pings and verifies Meta Cloud API connectivity for registered devices",
    category: "whatsapp",
    cronExpression: "*/5 * * * *",
    timeoutSeconds: 180,
    gracePeriodMins: 5,
  },
  {
    code: "vpn-server-health",
    name: "VPN Node Health Check",
    description:
      "Validates latency, load, and availability of VPN infrastructure",
    category: "vpn",
    cronExpression: "*/15 * * * *",
    timeoutSeconds: 600,
    gracePeriodMins: 15,
  },
  {
    code: "whatsapp-hourly-billing",
    name: "WhatsApp Hourly Billing Sync",
    description: "Processes usage rating and active conversation billing",
    category: "whatsapp",
    cronExpression: "0 * * * *",
    timeoutSeconds: 900,
    gracePeriodMins: 15,
  },
  {
    code: "whatsapp-analytics-sync",
    name: "WhatsApp Analytics Aggregator",
    description: "Rolls up hourly conversation and delivery metric snapshots",
    category: "whatsapp",
    cronExpression: "0 * * * *",
    timeoutSeconds: 600,
    gracePeriodMins: 15,
  },
  {
    code: "app-hosting-billing",
    name: "App Hosting PAYG Compute Billing",
    description:
      "Calculates CPU and RAM compute consumption for hosted containers",
    category: "billing",
    cronExpression: "0 * * * *",
    timeoutSeconds: 900,
    gracePeriodMins: 15,
  },
  {
    code: "vpn-renewal",
    name: "VPN Subscription Renewal",
    description:
      "Renews active VPN subscriptions and triggers renewal invoices",
    category: "vpn",
    cronExpression: "0 * * * *",
    timeoutSeconds: 900,
    gracePeriodMins: 15,
  },
  {
    code: "whatsapp-daily-device-digest",
    name: "WhatsApp Daily Device Digest",
    description:
      "Sends daily health and status digest email for all registered WhatsApp devices to platform admins",
    category: "whatsapp",
    cronExpression: "0 0 * * *",
    timeoutSeconds: 3600,
    gracePeriodMins: 15,
  },
  {
    code: "daily-count-cleanup",
    name: "Daily Usage Ledger Reset",
    description:
      "Cleans up rolling daily counters and resets rate-limit windows",
    category: "billing",
    cronExpression: "0 0 * * *",
    timeoutSeconds: 600,
    gracePeriodMins: 30,
  },
  {
    code: "invoice-status-transitions",
    name: "Invoice Status Manager",
    description:
      "Transitions draft invoices to ISSUED and marks overdue invoices",
    category: "billing",
    cronExpression: "0 2 * * *",
    timeoutSeconds: 1200,
    gracePeriodMins: 30,
  },
  {
    code: "renewal-ladder-transitions",
    name: "Subscription Renewal Ladder",
    description:
      "Processes subscription lifecycle transitions and grace periods",
    category: "billing",
    cronExpression: "0 4 * * *",
    timeoutSeconds: 1200,
    gracePeriodMins: 30,
  },
  {
    code: "payment-reminders",
    name: "Invoice Payment Reminders",
    description:
      "Dispatches automated email notifications for upcoming and overdue invoices",
    category: "billing",
    cronExpression: "0 9 * * *",
    timeoutSeconds: 1800,
    gracePeriodMins: 60,
  },
  {
    code: "monthly-count-cleanup",
    name: "Monthly Counter Reset",
    description:
      "Prunes legacy monthly rollup records at billing cycle boundary",
    category: "billing",
    cronExpression: "0 0 1 * *",
    timeoutSeconds: 1800,
    gracePeriodMins: 60,
  },
  {
    code: "monthly-billing-finalization",
    name: "Monthly Billing Cycle Finalization",
    description:
      "Aggregates usage ledger, finalizes draft invoices, and issues billing",
    category: "billing",
    cronExpression: "0 3 1 * *",
    timeoutSeconds: 3600,
    gracePeriodMins: 120,
  },
]

/**
 * Ensures all code-defined cron definitions exist in database.
 * Safe to call on system boot or schedule-runner startup.
 */
export const syncCronJobDefinitions = async (): Promise<
  CronJobDefinition[]
> => {
  const synced: CronJobDefinition[] = []

  for (const def of CRON_JOB_DEFINITIONS) {
    const job = await prisma.cronJobDefinition.upsert({
      where: { code: def.code },
      update: {
        name: def.name,
        description: def.description,
        category: def.category,
        cronExpression: def.cronExpression,
        timezone: def.timezone ?? "UTC",
        timeoutSeconds: def.timeoutSeconds ?? 3600,
        gracePeriodMins: def.gracePeriodMins ?? 15,
      },
      create: {
        code: def.code,
        name: def.name,
        description: def.description,
        category: def.category,
        cronExpression: def.cronExpression,
        timezone: def.timezone ?? "UTC",
        timeoutSeconds: def.timeoutSeconds ?? 3600,
        gracePeriodMins: def.gracePeriodMins ?? 15,
      },
    })
    synced.push(job)
  }

  return synced
}
