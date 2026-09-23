import "server-only"
import { prisma } from "@/lib/prisma"
import { StackStatus } from "@prisma/client"
import { adminPurgeTerminatedStack } from "@/modules/deploy/admin-stacks.service"
import { logger } from "@/lib/logger"

export async function runTerminatedStackPurge(): Promise<{
  processed: number
  purged: number
  failed: number
  errors: { stackId: string; error: string }[]
}> {
  const now = new Date()

  // Find all TERMINATED stacks whose scheduledPurgeAt has passed
  const stacks = await prisma.applicationStack.findMany({
    where: {
      status: StackStatus.TERMINATED,
      scheduledPurgeAt: { lte: now },
    },
    select: { id: true, slug: true, name: true, organizationId: true },
  })

  let purged = 0
  let failed = 0
  const errors: { stackId: string; error: string }[] = []

  for (const stack of stacks) {
    try {
      await adminPurgeTerminatedStack(stack.id)
      purged++
      logger.info(
        {
          event: "stack.purged",
          stackId: stack.id,
          slug: stack.slug,
          organizationId: stack.organizationId,
        },
        `Purged terminated stack ${stack.slug}`
      )
    } catch (err) {
      failed++
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ stackId: stack.id, error: message })
      logger.warn(
        {
          event: "stack.purge_failed",
          stackId: stack.id,
          slug: stack.slug,
          error: message,
        },
        `Failed to purge terminated stack ${stack.slug}`
      )
    }
  }

  return { processed: stacks.length, purged, failed, errors }
}
