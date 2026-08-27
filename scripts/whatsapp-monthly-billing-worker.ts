/**
 * WhatsApp Monthly Billing Worker
 *
 * Charges one subscription-level base order and resets allowances for all
 * active WhatsApp devices attached to that subscription.
 * Runs via cron or BullMQ repeatable job at the start of each billing period.
 *
 * Idempotent: uses service-subscription:<subscriptionId>:<period> keys.
 * Safe to retry: subsequent runs reuse the existing period order and reset
 * allowances without charging again.
 *
 * NOTE: Allowance reset race
 * ---------------------------
 * The worker resets quotaBaseOut at the start of each period while messages
 * may still be in flight. If a message send reads the old (pre-reset) allowance
 * just before the worker resets, then the worker resets, the send path may
 * incorrectly charge overage for what should have been allowance-covered messages.
 *
 * Impact: temporary overcharge that resolves at next month's allowance reset.
 * Mitigation: schedule this worker during low-traffic windows (e.g., 00:05 UTC).
 * Long-term: use a versioned allowance system or distributed lock per device.
 *
 * Usage: bun run scripts/whatsapp-monthly-billing-worker.ts
 */

import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { BillingOrderService } from "@/modules/billing/orders/order.service"
import { runWhatsappBillingCycle } from "@/modules/whatsapp/billing/whatsapp-billing.service"

async function getCurrentPeriod(): Promise<string> {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

async function chargeMonthlyBases(): Promise<{
  charged: number
  skipped: number
  errors: number
}> {
  return runWhatsappBillingCycle(
    prisma,
    new BillingOrderService(prisma),
    new Date()
  )
}

async function main() {
  logger.info(
    { event: "whatsapp_billing.cycle_started" },
    "[whatsapp-billing] Starting monthly billing cycle..."
  )
  const period = await getCurrentPeriod()
  logger.info(
    { event: "whatsapp_billing.period_resolved", period },
    `[whatsapp-billing] Period: ${period}`
  )

  const result = await chargeMonthlyBases()

  logger.info(
    {
      event: "whatsapp_billing.cycle_completed",
      charged: result.charged,
      skipped: result.skipped,
      errors: result.errors,
      period,
    },
    `[whatsapp-billing] Complete: ${result.charged} charged, ${result.skipped} skipped, ${result.errors} errors`
  )

  if (result.errors > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  logger.error(
    { err, event: "whatsapp_billing.fatal_error" },
    "[whatsapp-billing] Fatal error:"
  )
  process.exit(1)
})
