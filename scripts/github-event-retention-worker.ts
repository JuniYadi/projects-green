import { prisma } from "@/lib/prisma"
import { cleanupGithubWebhookEvents } from "@/modules/github/github-event-log.service"

const main = async () => {
  console.info("[github-event-retention] starting cleanup")
  const result = await cleanupGithubWebhookEvents({ prisma })
  console.info(
    `[github-event-retention] completed softDeleted=${result.softDeleted} permanentlyDeleted=${result.permanentlyDeleted}`
  )
}

main()
  .catch((error) => {
    console.error("[github-event-retention] failed", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
