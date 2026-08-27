import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { cleanupGithubWebhookEvents } from "@/modules/github/github-event-log.service"

const main = async () => {
  logger.info(
    {
      event: "github.event_retention.started",
    },
    "[github-event-retention] starting cleanup"
  )
  const result = await cleanupGithubWebhookEvents({ prisma })
  logger.info(
    {
      event: "github.event_retention.completed",
      softDeleted: result.softDeleted,
      permanentlyDeleted: result.permanentlyDeleted,
    },
    `[github-event-retention] completed softDeleted=${result.softDeleted} permanentlyDeleted=${result.permanentlyDeleted}`
  )
}

main()
  .catch((error) => {
    logger.error(
      {
        event: "github.event_retention.failed",
        err: error,
      },
      "[github-event-retention] failed"
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
