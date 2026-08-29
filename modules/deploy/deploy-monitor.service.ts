import { prisma } from "@/lib/prisma"
/**
 * PGREEN-072 — Deploy Monitor Service
 *
 * The wizard monitor uses a 900ms polling interval (MONITOR_POLL_INTERVAL_MS)
 * for status updates during active deployments. The timeline component uses
 * its own independent 3000ms polling interval (POLL_INTERVAL_MS) for fetching
 * status, events, and logs. Both intervals stop polling when the deployment
 * reaches terminal states (running, failed, idle).
 */
import { recordDeployEventOnce, recordDeployLog } from "./deploy-event.service"
import { processQueuedDeployment } from "./deploy-builder.service"
import { pollDeploymentRollout } from "./argocd-rollout.service"
import { checkIngressReadiness } from "./ingress-readiness.service"

const BATCH_SIZE = 10

// Bounds how long a RUNNING deployment stays in the ingress recheck set —
// beyond this window we stop retrying and leave ingressVerified as-is.
const INGRESS_RECHECK_WINDOW_MS = 30 * 60 * 1000

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
      OR: [
        { status: { in: ["QUEUED", "BUILDING", "DEPLOYING"] } },
        {
          status: "RUNNING",
          ingressVerified: false,
          completedAt: {
            gt: new Date(Date.now() - INGRESS_RECHECK_WINDOW_MS),
          },
        },
      ],
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
        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : "Monitor error"
        console.error(
          `[deploy-monitor] failed to check deployment ${deployment.id}:`,
          reason
        )

        await prisma.applicationDeployment.update({
          where: { id: deployment.id },
          data: {
            status: "FAILED",
            failureReason: reason,
            completedAt: new Date(),
          },
        })

        await recordDeployEventOnce({
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
  // Process QUEUED deployments through the builder pipeline
  if (deployment.status === "QUEUED") {
    const result = await processQueuedDeployment(deployment.id)
    if (result.processed) {
      return {
        deploymentId: deployment.id,
        status: result.status,
        manifestPushed: result.status === "RUNNING",
        argocdSynced: result.status === "RUNNING",
      }
    }
  }

  // Wire ArgoCD polling for DEPLOYING deployments
  if (deployment.status === "DEPLOYING") {
    const rollout = await pollDeploymentRollout(deployment.id)
    if (rollout.status) {
      return {
        deploymentId: deployment.id,
        status: rollout.completed ? "RUNNING" : deployment.status,
        manifestPushed: deployment.manifestPushed,
        argocdSynced:
          deployment.argocdSynced || rollout.status.syncStatus === "Synced",
      }
    }
  }

  // Re-check ingress/DNS readiness for RUNNING deployments that haven't
  // verified yet — never touches status, only the ingress fields.
  if (deployment.status === "RUNNING") {
    const ingressVerified = await checkIngressReadiness(deployment.id)
    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: { ingressVerified, ingressCheckedAt: new Date() },
    })
    return {
      deploymentId: deployment.id,
      status: deployment.status,
      manifestPushed: deployment.manifestPushed,
      argocdSynced: deployment.argocdSynced,
    }
  }

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
