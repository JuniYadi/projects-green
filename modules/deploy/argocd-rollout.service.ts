import { prisma } from "@/lib/prisma"
import {
  resolveClusterIntegration,
  type ArgoCdClusterConfig,
} from "./cluster-integration.service"
import { recordDeployEventOnce } from "./deploy-event.service"
import { checkIngressReadiness } from "./ingress-readiness.service"

export type ArgoCdApplicationStatus = {
  syncStatus: string | null
  healthStatus: string | null
}

export async function getArgoCdApplicationStatus(
  config: ArgoCdClusterConfig,
  applicationName: string
): Promise<ArgoCdApplicationStatus> {
  const baseUrl = config.apiUrl.replace(/\/$/, "")
  const url = `${baseUrl}/api/v1/applications/${encodeURIComponent(
    applicationName
  )}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
    },
  })

  if (response.status === 404) {
    throw new Error(`ArgoCD application not found: ${applicationName}`)
  }

  if (!response.ok) {
    throw new Error(
      `ArgoCD API error ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as {
    status?: {
      sync?: { status?: string }
      health?: { status?: string }
    }
  }

  return {
    syncStatus: data.status?.sync?.status ?? null,
    healthStatus: data.status?.health?.status ?? null,
  }
}

const ARGOCD_ROLLOUT_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes max timeout

export async function pollDeploymentRollout(deploymentId: string): Promise<{
  completed: boolean
  status: ArgoCdApplicationStatus | null
}> {
  const deployment = await prisma.applicationDeployment.findUnique({
    where: { id: deploymentId },
    include: { stack: true },
  })

  if (!deployment) {
    return { completed: false, status: null }
  }

  // Check if deployment rollout has exceeded maximum timeout
  const startTime = deployment.startedAt ?? deployment.createdAt
  const isTimedOut =
    Date.now() - new Date(startTime).getTime() > ARGOCD_ROLLOUT_TIMEOUT_MS

  if (isTimedOut && deployment.status === "DEPLOYING") {
    await prisma.$transaction(async (tx) => {
      await tx.applicationDeployment.update({
        where: { id: deployment.id },
        data: {
          status: "FAILED",
          failureReason:
            "ArgoCD rollout timed out after 15 minutes. Check cluster sync and pod status.",
          completedAt: new Date(),
        },
      })
      await tx.applicationStack.update({
        where: { id: deployment.stackId },
        data: { lastDeployStatus: "FAILED" },
      })
      await recordDeployEventOnce(
        {
          deploymentId: deployment.id,
          type: "DEPLOY_FAILED",
          message: `ArgoCD rollout timed out for ${deployment.stack.slug}`,
          metadata: { reason: "TIMEOUT" },
        },
        tx
      )
      await recordDeployLog({
        deploymentId: deployment.id,
        scope: "deploy",
        status: "FAILED",
        message:
          "ArgoCD rollout timed out after 15 minutes. Check cluster sync and pod status.",
      })
    })
    return { completed: true, status: null }
  }

  let argocdConfig: ArgoCdClusterConfig
  try {
    argocdConfig = await resolveClusterIntegration(deployment.stackId, "ARGOCD")
  } catch {
    return { completed: false, status: null }
  }

  let status: ArgoCdApplicationStatus
  try {
    status = await getArgoCdApplicationStatus(
      argocdConfig,
      deployment.stack.slug
    )
  } catch (err) {
    console.error(
      `[argocd-rollout] Failed to read ArgoCD status for ${deployment.stack.slug}:`,
      err
    )
    return { completed: false, status: null }
  }

  if (status.syncStatus === "Synced" && !deployment.argocdSynced) {
    await prisma.$transaction(async (tx) => {
      await tx.applicationDeployment.update({
        where: { id: deployment.id },
        data: { argocdSynced: true, argocdSyncedAt: new Date() },
      })
      await recordDeployEventOnce(
        {
          deploymentId: deployment.id,
          type: "ARGOCD_SYNCED" as any,
          message: `ArgoCD synced ${deployment.stack.slug}`,
          metadata: { syncStatus: status.syncStatus },
        },
        tx
      )
    })
  }

  if (status.healthStatus === "Healthy") {
    await prisma.$transaction(async (tx) => {
      await tx.applicationDeployment.update({
        where: { id: deployment.id },
        data: {
          status: "RUNNING",
          ...(deployment.completedAt ? {} : { completedAt: new Date() }),
        },
      })
      await tx.applicationStack.update({
        where: { id: deployment.stackId },
        data: {
          status: "RUNNING",
          lastDeployStatus: "RUNNING",
          lastDeployedAt: new Date(),
        },
      })
      await recordDeployEventOnce(
        {
          deploymentId: deployment.id,
          type: "POD_READY" as any,
          message: `Pods ready for ${deployment.stack.slug}`,
          metadata: {
            syncStatus: status.syncStatus,
            healthStatus: status.healthStatus,
          },
        },
        tx
      )
      await recordDeployEventOnce(
        {
          deploymentId: deployment.id,
          type: "DEPLOY_COMPLETED" as any,
          message: `Deployment completed for ${deployment.stack.slug}`,
          metadata: {
            syncStatus: status.syncStatus,
            healthStatus: status.healthStatus,
          },
        },
        tx
      )
    })

    try {
      const ingressVerified = await checkIngressReadiness(deployment.id)
      await prisma.applicationDeployment.update({
        where: { id: deployment.id },
        data: { ingressVerified, ingressCheckedAt: new Date() },
      })
    } catch (err) {
      console.error(
        `[argocd-rollout] Failed to check ingress readiness for ${deployment.stack.slug}:`,
        err
      )
    }

    return { completed: true, status }
  }

  if (status.healthStatus === "Degraded") {
    await prisma.$transaction(async (tx) => {
      await tx.applicationDeployment.update({
        where: { id: deployment.id },
        data: {
          status: "FAILED",
          failureReason: "ArgoCD application degraded",
          ...(deployment.completedAt ? {} : { completedAt: new Date() }),
        },
      })
      await tx.applicationStack.update({
        where: { id: deployment.stackId },
        data: { lastDeployStatus: "FAILED" },
      })
      await recordDeployEventOnce(
        {
          deploymentId: deployment.id,
          type: "DEPLOY_FAILED" as any,
          message: `ArgoCD application degraded for ${deployment.stack.slug}`,
          metadata: { healthStatus: status.healthStatus },
        },
        tx
      )
    })
    return { completed: true, status }
  }

  return { completed: false, status }
}
