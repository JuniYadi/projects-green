import { prisma } from "@/lib/prisma"
import { recordDeployEvent, recordDeployLog } from "./deploy-event.service"

const BATCH_SIZE = 10

async function chunkArray<T>(array: T[], size: number): Promise<T[][]> {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export async function monitorActiveDeployments() {
  const activeDeployments = await prisma.applicationDeployment.findMany({
    where: {
      status: { in: ["QUEUED", "BUILDING", "DEPLOYING"] },
    },
    include: { stack: true },
    orderBy: { createdAt: "asc" },
  })

  const results = []
  const batches = await chunkArray(activeDeployments, BATCH_SIZE)

  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map((deployment) => checkDeploymentStatus(deployment))
    )

    for (let i = 0; i < batch.length; i++) {
      const result = batchResults[i]
      if (result.status === "rejected") {
        const deployment = batch[i]
        const reason = result.reason instanceof Error ? result.reason.message : "Monitor error"
        console.error(
          `[deploy-monitor] failed to check deployment ${deployment.id}:`,
          reason
        )

        await prisma.applicationDeployment.update({
          where: { id: deployment.id },
          data: { status: "FAILED", failureReason: reason, completedAt: new Date() },
        })

        await recordDeployEvent({
          deploymentId: deployment.id,
          type: "DEPLOY_FAILED",
          message: `Monitor detected failure: ${reason}`,
        })

        // Only update lastDeployStatus, not the full status - stack can still accept new deploys
        await prisma.applicationStack.update({
          where: { id: deployment.stackId },
          data: { lastDeployStatus: "FAILED" },
        })
      } else {
        results.push(result.value)
      }
    }
  }

  return results
}

async function checkDeploymentStatus(deployment: {
  id: string
  stackId: string
  status: string
  manifestPushed: boolean
  argocdSynced: boolean
  attempt: number
  stack: { name: string }
}) {
  // In production, this would:
  // 1. Check GitHub repo for manifest push status
  // 2. Poll ArgoCD API for sync status
  // 3. Check container readiness in K8s

  // Simplified logic for now
  if (!deployment.manifestPushed) {
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "build",
      status: "info",
      message: `Checking manifest push status for ${deployment.stack.name}...`,
    })
  }

  if (deployment.manifestPushed && !deployment.argocdSynced) {
    await recordDeployLog({
      deploymentId: deployment.id,
      scope: "runtime",
      status: "info",
      message: `Checking ArgoCD sync status for ${deployment.stack.name}...`,
    })
  }

  return {
    deploymentId: deployment.id,
    status: deployment.status,
    manifestPushed: deployment.manifestPushed,
    argocdSynced: deployment.argocdSynced,
  }
}

export async function getMonitorStats() {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const [active, recentFailed, recentSuccess] = await Promise.all([
    prisma.applicationDeployment.count({
      where: { status: { in: ["QUEUED", "BUILDING", "DEPLOYING"] } },
    }),
    prisma.applicationDeployment.count({
      where: {
        status: "FAILED",
        createdAt: { gte: oneHourAgo },
      },
    }),
    prisma.applicationDeployment.count({
      where: {
        status: "RUNNING",
        completedAt: { gte: oneHourAgo },
      },
    }),
  ])

  return { active, recentFailed, recentSuccess }
}
