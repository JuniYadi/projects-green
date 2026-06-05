/**
 * WhatsApp Monthly Billing Worker
 *
 * Charges monthly base price and resets allowance for all active WhatsApp devices.
 * Runs via cron or BullMQ repeatable job at the start of each billing period.
 *
 * Idempotent: uses wa-base:{deviceId}:{period} idempotency key.
 * Safe to retry: subsequent runs skip already-charged devices.
 *
 * Usage: bun run scripts/whatsapp-monthly-billing-worker.ts
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { WhatsappBillingService } from "@/modules/whatsapp/billing/whatsapp-billing.service"
import type { WhatsAppPlanResources } from "@/modules/billing/types"

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

  // Find all active WhatsApp devices with an active WhatsApp subscription
  const devices = await prisma.whatsappDevice.findMany({
    where: { status: "ACTIVE" },
  })

  let charged = 0
  let skipped = 0
  let errors = 0

  for (const device of devices) {
    try {
      // Find the organization's active WhatsApp subscription and pricing
      const subscription = await prisma.subscription.findFirst({
        where: {
          organizationId: device.organizationId,
          package: { code: "WHATSAPP" },
          status: "ACTIVE",
        },
        include: {
          pricing: true,
          plan: true,
        },
      })

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
