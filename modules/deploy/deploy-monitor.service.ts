import { prisma } from "@/lib/prisma"
import { recordDeployEvent, recordDeployLog } from "./deploy-event.service"

export async function monitorActiveDeployments() {
  const activeDeployments = await prisma.deployment.findMany({
    where: {
      status: { in: ["QUEUED", "BUILDING", "DEPLOYING"] },
    },
    include: { stack: true },
    orderBy: { createdAt: "asc" },
  })

  const results = []

  for (const deployment of activeDeployments) {
    try {
      const result = await checkDeploymentStatus(deployment)
      results.push(result)
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Monitor error"
      console.error(
        `[deploy-monitor] failed to check deployment ${deployment.id}:`,
        reason
      )

      await prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: "FAILED", failureReason: reason, completedAt: new Date() },
      })

      await recordDeployEvent({
        deploymentId: deployment.id,
        type: "DEPLOY_FAILED",
        message: `Monitor detected failure: ${reason}`,
      })

      await prisma.applicationStack.update({
        where: { id: deployment.stackId },
        data: { status: "FAILED", lastDeployStatus: "FAILED" },
      })
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
    prisma.deployment.count({
      where: { status: { in: ["QUEUED", "BUILDING", "DEPLOYING"] } },
    }),
    prisma.deployment.count({
      where: {
        status: "FAILED",
        createdAt: { gte: oneHourAgo },
      },
    }),
    prisma.deployment.count({
      where: {
        status: "RUNNING",
        completedAt: { gte: oneHourAgo },
      },
    }),
  ])

  return { active, recentFailed, recentSuccess }
}
