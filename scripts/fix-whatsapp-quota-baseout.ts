#!/usr/bin/env bun
/**
 * Backfill: fix existing WhatsApp devices whose quotaBaseOut was incorrectly set to 0.
 *
 * The original code initialized quotaBaseOut to 0 instead of quotaBase, so every
 * device showed "1000 / 1000 used" on the usage page regardless of actual sends.
 *
 * For each device with quotaBaseOut == 0 and quotaBase > 0:
 *   consumed = SUM(WhatsappBillingLedger.quotaValue) for the current period
 *   quotaBaseOut = max(0, quotaBase - consumed)
 *
 * Run: bun run scripts/fix-whatsapp-quota-baseout.ts
 * Safe to re-run (idempotent for devices already fixed by a previous run or
 * by the hourly worker).
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const currentPeriod = (() => {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  return {
    year: y,
    month: now.getUTCMonth() + 1,
    period: `${y}-${m}`,
    periodStart: new Date(`${y}-${m}-01`),
  }
})()

async function main() {
  console.info(`[fix-wa-quota] Period: ${currentPeriod.period}`)

  // Find devices that need fixing: quotaBase > 0 but quotaBaseOut <= 0
  const devices = await prisma.whatsappDevice.findMany({
    where: {
      quotaBase: { gt: 0 },
      quotaBaseOut: { lte: 0 },
    },
    select: {
      id: true,
      phoneNumber: true,
      organizationId: true,
      quotaBase: true,
      quotaBaseOut: true,
    },
  })

  console.info(
    `[fix-wa-quota] Found ${devices.length} device(s) with quotaBaseOut <= 0`
  )

  let fixed = 0
  let skipped = 0

  for (const device of devices) {
    // Sum quota consumed this period from billing ledger
    const aggregation = await prisma.whatsappBillingLedger.aggregate({
      where: {
        organizationId: device.organizationId,
        whatsappDeviceId: device.id,
        isReverted: false,
        createdAt: { gte: currentPeriod.periodStart },
      },
      _sum: { quotaValue: true },
    })

    const consumed = Number(aggregation._sum.quotaValue ?? 0)
    const newQuotaBaseOut = Math.max(0, Number(device.quotaBase) - consumed)

    if (newQuotaBaseOut === 0 && consumed > 0) {
      // All quota legitimately consumed — no fix needed
      console.info(
        `  [skip]  ${device.phoneNumber}: fully consumed (quotaBase=${device.quotaBase}, consumed=${consumed})`
      )
      skipped++
      continue
    }

    if (newQuotaBaseOut === Number(device.quotaBaseOut)) {
      skipped++
      continue
    }

    await prisma.whatsappDevice.update({
      where: { id: device.id },
      data: { quotaBaseOut: newQuotaBaseOut },
    })

    console.info(
      `  [fix]   ${device.phoneNumber}: quotaBaseOut ${device.quotaBaseOut} → ${newQuotaBaseOut} (consumed=${consumed})`
    )
    fixed++
  }

  console.info(
    `[fix-wa-quota] Fixed: ${fixed}, Skipped: ${skipped}, Total: ${devices.length}`
  )
}

main()
  .catch((err) => {
    console.error("[fix-wa-quota] Failed:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
