#!/usr/bin/env bun
/**
 * Standalone WhatsApp Analytics Worker
 *
 * Synces last 7 days of analytics for all active devices every hour.
 * Reports discrepancies to console (extend to admin channel when infra exists).
 *
 * Usage: bun run scripts/whatsapp-analytics-worker.ts
 */
import { prisma } from "@/lib/prisma"
import { analyticsService } from "@/modules/whatsapp/analytics/analytics.service"

const INTERVAL_MS = 3_600_000 // 1 hour

async function syncCycle() {
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
          `[whatsapp-analytics-worker] device=${device.id} discrepancies=${result.discrepancies.length}`
        )
        // ponytail: log discrepancies, send to admin channel when channel infra exists
        for (const d of result.discrepancies.slice(0, 5)) {
          console.warn(
            `  ${d.date} ${d.metric}: meta=${d.metaValue} local=${d.localValue} delta=${d.deltaPercent.toFixed(1)}%`
          )
        }
      }
    } catch (error) {
      errors++
      console.error(`[whatsapp-analytics-worker] device=${device.id} error:`, error)
    }
  }

  console.info(
    `[whatsapp-analytics-worker] synced=${synced} errors=${errors} devices=${activeDevices.length}`
  )
}

// Run once immediately, then every hour
syncCycle().catch(console.error)
setInterval(syncCycle, INTERVAL_MS)

// Graceful shutdown
process.on("SIGTERM", () => {
  console.info("[whatsapp-analytics-worker] SIGTERM received, exiting")
  process.exit(0)
})
process.on("SIGINT", () => {
  console.info("[whatsapp-analytics-worker] SIGINT received, exiting")
  process.exit(0)
})
