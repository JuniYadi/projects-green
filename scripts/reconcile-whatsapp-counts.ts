#!/usr/bin/env bun
/**
 * Reconciliation script: Recompute WhatsappDailyCount and WhatsappMonthlyCount
 * from authoritative WhatsappMessage records to fix double-counting from Meta sync.
 *
 * Usage:
 *   bun run scripts/reconcile-whatsapp-counts.ts
 *
 * Dry Run:
 *   DRY_RUN=true bun run scripts/reconcile-whatsapp-counts.ts
 */

import { prisma } from "@/lib/prisma"

const isDryRun = process.env.DRY_RUN === "true"

async function reconcile() {
  console.info(
    `[reconcile-wa-counts] Starting reconciliation (DRY_RUN=${isDryRun})...\n`
  )

  const devices = await prisma.whatsappDevice.findMany({
    select: {
      id: true,
      phoneNumber: true,
      organizationId: true,
      whatsappProfile: true,
    },
  })

  console.info(`Found ${devices.length} WhatsApp devices to check.\n`)

  for (const device of devices) {
    const verifiedName =
      (device.whatsappProfile as Record<string, unknown>)?.verified_name ??
      "N/A"
    console.info(
      `================================================================`
    )
    console.info(
      `Device: ${device.phoneNumber} (${verifiedName}) [${device.id}]`
    )
    console.info(`Organization: ${device.organizationId}`)

    // 1. Fetch all conversations belonging to this device
    const conversations = await prisma.whatsappConversation.findMany({
      where: { whatsappDeviceId: device.id },
      select: { id: true },
    })
    const conversationIds = conversations.map((c) => c.id)

    if (conversationIds.length === 0) {
      console.info(`No conversations found. Skipping.\n`)
      continue
    }

    // 2. Fetch all messages for this device to calculate real counts by date
    const messages = await prisma.whatsappMessage.findMany({
      where: { conversationId: { in: conversationIds } },
      select: {
        id: true,
        direction: true,
        createdAt: true,
      },
    })

    console.info(`Total actual messages in DB: ${messages.length}`)

    // Group actual messages by date (YYYY-MM-DD)
    const dailyMap = new Map<string, { inbox: number; outbox: number }>()

    for (const msg of messages) {
      const dateStr = msg.createdAt.toISOString().slice(0, 10)
      const current = dailyMap.get(dateStr) ?? { inbox: 0, outbox: 0 }
      if (msg.direction === "INBOX") {
        current.inbox += 1
      } else if (msg.direction === "OUTBOX") {
        current.outbox += 1
      }
      dailyMap.set(dateStr, current)
    }

    // 3. Reconcile WhatsappDailyCount
    const existingDailyCounts = await prisma.whatsappDailyCount.findMany({
      where: { whatsappDeviceId: device.id },
    })

    console.info(
      `\nReconciling Daily Counts (${existingDailyCounts.length} records in DB)...`
    )

    for (const daily of existingDailyCounts) {
      const dateStr = daily.date.toISOString().slice(0, 10)
      const actual = dailyMap.get(dateStr) ?? { inbox: 0, outbox: 0 }

      const needsUpdate =
        daily.messageInboxCount !== actual.inbox ||
        daily.messageOutboxCount !== actual.outbox

      if (needsUpdate) {
        console.info(
          `  [Daily ${dateStr}] Current: (In: ${daily.messageInboxCount}, Out: ${daily.messageOutboxCount}) -> Real: (In: ${actual.inbox}, Out: ${actual.outbox})`
        )

        if (!isDryRun) {
          await prisma.whatsappDailyCount.update({
            where: { id: daily.id },
            data: {
              messageInboxCount: actual.inbox,
              messageOutboxCount: actual.outbox,
            },
          })
        }
      } else {
        console.info(
          `  [Daily ${dateStr}] Already matching (In: ${actual.inbox}, Out: ${actual.outbox})`
        )
      }
    }

    // 4. Reconcile WhatsappMonthlyCount (Group by Year & Month)
    const monthlyMap = new Map<string, { inbox: number; outbox: number }>()

    for (const [dateStr, counts] of dailyMap.entries()) {
      const yearMonth = dateStr.slice(0, 7) // "YYYY-MM"
      const current = monthlyMap.get(yearMonth) ?? { inbox: 0, outbox: 0 }
      current.inbox += counts.inbox
      current.outbox += counts.outbox
      monthlyMap.set(yearMonth, current)
    }

    const existingMonthlyCounts = await prisma.whatsappMonthlyCount.findMany({
      where: { whatsappDeviceId: device.id },
    })

    console.info(
      `\nReconciling Monthly Counts (${existingMonthlyCounts.length} records in DB)...`
    )

    for (const monthly of existingMonthlyCounts) {
      const key = `${monthly.year}-${String(monthly.month).padStart(2, "0")}`
      const actual = monthlyMap.get(key) ?? { inbox: 0, outbox: 0 }

      const needsUpdate =
        monthly.messageInboxCount !== actual.inbox ||
        monthly.messageOutboxCount !== actual.outbox

      if (needsUpdate) {
        console.info(
          `  [Monthly ${key}] Current: (In: ${monthly.messageInboxCount}, Out: ${monthly.messageOutboxCount}) -> Real: (In: ${actual.inbox}, Out: ${actual.outbox})`
        )

        if (!isDryRun) {
          await prisma.whatsappMonthlyCount.update({
            where: { id: monthly.id },
            data: {
              messageInboxCount: actual.inbox,
              messageOutboxCount: actual.outbox,
            },
          })
        }
      } else {
        console.info(
          `  [Monthly ${key}] Already matching (In: ${actual.inbox}, Out: ${actual.outbox})`
        )
      }
    }

    console.info(`\n`)
  }

  console.info(`[reconcile-wa-counts] Finished successfully!`)
}

reconcile()
  .catch((err) => {
    console.error("[reconcile-wa-counts] Error:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
