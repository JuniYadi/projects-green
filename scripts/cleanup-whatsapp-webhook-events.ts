import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

const RETENTION_DAYS = 90
const BATCH_SIZE = 1000

function isDryRun(): boolean {
  const args = process.argv.slice(2)
  return args.includes("--dry-run")
}

function parseDurationMs(start: bigint): string {
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6
  return `${elapsed.toFixed(0)}ms`
}

const main = async () => {
  const dryRun = isDryRun()
  const startTime = process.hrtime.bigint()
  logger.info(
    {
      event: "cleanup.whatsapp_webhook_events.started",
      dryRun,
    },
    `[cleanup-webhook-events] starting${dryRun ? " (DRY RUN)" : ""}`
  )

  // Calculate cutoff date: 90 days ago
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

  logger.info(
    {
      event: "cleanup.whatsapp_webhook_events.cutoff_calculated",
      cutoffDate: cutoffDate.toISOString(),
      retentionDays: RETENTION_DAYS,
    },
    `[cleanup-webhook-events] cutoff date: ${cutoffDate.toISOString()}`
  )

  // Count total deletable rows first
  const totalCount = await prisma.whatsappWebhookEvent.count({
    where: {
      createdAt: { lt: cutoffDate },
    },
  })

  logger.info(
    {
      event: "cleanup.whatsapp_webhook_events.count_found",
      totalCount,
      retentionDays: RETENTION_DAYS,
    },
    `[cleanup-webhook-events] found ${totalCount} event(s) older than ${RETENTION_DAYS} days`
  )

  if (totalCount === 0) {
    logger.info(
      {
        event: "cleanup.whatsapp_webhook_events.noop",
      },
      "[cleanup-webhook-events] nothing to clean up"
    )
    return
  }

  if (dryRun) {
    logger.info(
      {
        event: "cleanup.whatsapp_webhook_events.dry_run_summary",
        totalCount,
        duration: parseDurationMs(startTime),
      },
      `[cleanup-webhook-events] dry run: would delete ${totalCount} event(s) in ${parseDurationMs(startTime)}`
    )
    return
  }

  // Delete in batches to avoid long-running transactions
  let deletedTotal = 0

  while (deletedTotal < totalCount) {
    const batch = await prisma.whatsappWebhookEvent.findMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
      select: { id: true },
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    })

    if (batch.length === 0) break

    const batchIds = batch.map((row) => row.id)

    const result = await prisma.whatsappWebhookEvent.deleteMany({
      where: { id: { in: batchIds } },
    })

    deletedTotal += result.count

    logger.info(
      {
        event: "cleanup.whatsapp_webhook_events.batch_deleted",
        batchCount: result.count,
        deletedTotal,
        totalCount,
      },
      `[cleanup-webhook-events] deleted batch of ${result.count} events (${deletedTotal}/${totalCount})`
    )
  }

  logger.info(
    {
      event: "cleanup.whatsapp_webhook_events.completed",
      deletedTotal,
      duration: parseDurationMs(startTime),
    },
    `[cleanup-webhook-events] completed: deleted ${deletedTotal} event(s) in ${parseDurationMs(startTime)}`
  )
}

main()
  .catch((error) => {
    logger.error(
      {
        event: "cleanup.whatsapp_webhook_events.failed",
        err: error,
      },
      "[cleanup-webhook-events] failed"
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
