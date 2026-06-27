import { prisma } from "@/lib/prisma"

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

  console.info(`[cleanup-webhook-events] starting${dryRun ? " (DRY RUN)" : ""}`)

  // Calculate cutoff date: 90 days ago
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

  console.info(
    `[cleanup-webhook-events] cutoff date: ${cutoffDate.toISOString()}`
  )

  // Count total deletable rows first
  const totalCount = await prisma.whatsappWebhookEvent.count({
    where: {
      createdAt: { lt: cutoffDate },
    },
  })

  console.info(
    `[cleanup-webhook-events] found ${totalCount} event(s) older than ${RETENTION_DAYS} days`
  )

  if (totalCount === 0) {
    console.info("[cleanup-webhook-events] nothing to clean up")
    return
  }

  if (dryRun) {
    console.info(
      `[cleanup-webhook-events] dry run: would delete ${totalCount} event(s)`
    )
    console.info(
      `[cleanup-webhook-events] completed in ${parseDurationMs(startTime)}`
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

    console.info(
      `[cleanup-webhook-events] deleted batch of ${result.count} events (${deletedTotal}/${totalCount})`
    )
  }

  console.info(
    `[cleanup-webhook-events] completed: deleted ${deletedTotal} event(s) in ${parseDurationMs(startTime)}`
  )
}

main()
  .catch((error) => {
    console.error("[cleanup-webhook-events] failed", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
