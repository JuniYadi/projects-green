/**
 * WhatsApp Monthly Billing Worker
 *
 * Charges monthly base price and resets allowance for all active WhatsApp devices.
 * Runs via cron or BullMQ repeatable job at the start of each billing period.
 *
 * Idempotent: uses wa-base:{deviceId}:{period} idempotency key.
 * Safe to retry: subsequent runs skip already-charged devices.
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

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { WhatsappBillingService } from "@/modules/whatsapp/billing/whatsapp-billing.service"
import type { WhatsAppPlanResources } from "@/modules/billing/types"

const BATCH_SIZE = 100

async function getCurrentPeriod(): Promise<string> {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function extractAllowance(resources: WhatsAppPlanResources | null): number {
  if (!resources) return 0
  // Try canonical field first, fall back to legacy
  return resources.quotaOutMonthly ?? resources.quotaOut ?? 0
}

async function chargeMonthlyBases(): Promise<{
  charged: number
  skipped: number
  errors: number
}> {
  const transactions = new BillingTransactionService(prisma)
  const whatsappBilling = new WhatsappBillingService(prisma, transactions)
  const period = await getCurrentPeriod()

  let charged = 0
  let skipped = 0
  let errors = 0
  let cursor: string | undefined

  while (true) {
    // Batch: fetch active devices with cursor-based pagination
    const devices = await prisma.whatsappDevice.findMany({
      where: { status: "ACTIVE" },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    })

    if (devices.length === 0) break

    // Batch: preload subscriptions for all orgs in this batch
    // (avoids N+1 queries where N = device count)
    const orgIds = [...new Set(devices.map((d) => d.organizationId))]
    const subscriptions = await prisma.serviceSubscription.findMany({
      where: {
        organizationId: { in: orgIds },
        package: { code: "WHATSAPP" },
        status: "ACTIVE",
      },
      include: {
        pricing: true,
        plan: true,
      },
    })

    const subByOrg = new Map(subscriptions.map((s) => [s.organizationId, s]))

    for (const device of devices) {
      try {
        const subscription = subByOrg.get(device.organizationId)

        if (!subscription) {
          skipped++
          continue
        }

        const basePrice = new Prisma.Decimal(
          subscription.pricing.basePriceIdr.toString(),
        )

        // Extract allowance from plan resources JSON
        const resources = subscription.plan?.resources as WhatsAppPlanResources | null
        const allowance = extractAllowance(resources)

        // Skip if base price is 0 — no charge needed (free plan)
        if (basePrice.lte(0)) {
          // Still reset allowance even if free
          await prisma.whatsappDevice.update({
            where: { id: device.id },
            data: { quotaBaseOut: allowance },
          })
          skipped++
          continue
        }

        await whatsappBilling.chargeMonthlyBase({
          organizationId: device.organizationId,
          deviceId: device.id,
          amount: basePrice,
          allowance,
          period,
        })

        charged++
        console.info(
          `[whatsapp-billing] device=${device.id} phone=${device.phoneNumber} charged ${basePrice.toString()} IDR, allowance reset to ${allowance}`,
        )
      } catch (error) {
        errors++
        console.error(
          `[whatsapp-billing] device=${device.id} phone=${device.phoneNumber} error:`,
          error,
        )
      }
    }

    cursor = devices[devices.length - 1].id
  }

  return { charged, skipped, errors }
}

async function main() {
  console.info("[whatsapp-billing] Starting monthly billing cycle...")
  const period = await getCurrentPeriod()
  console.info(`[whatsapp-billing] Period: ${period}`)

  const result = await chargeMonthlyBases()

  console.info(
    `[whatsapp-billing] Complete: ${result.charged} charged, ${result.skipped} skipped, ${result.errors} errors`,
  )

  if (result.errors > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("[whatsapp-billing] Fatal error:", err)
  process.exit(1)
})
