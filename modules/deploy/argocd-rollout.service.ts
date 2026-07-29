import { prisma } from "@/lib/prisma"
import {
  resolveClusterIntegration,
  type ArgoCdClusterConfig,
} from "./cluster-integration.service"
import { recordDeployEvent } from "./deploy-event.service"

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
    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: { argocdSynced: true, argocdSyncedAt: new Date() },
    })
    await recordDeployEvent({
      deploymentId: deployment.id,
      type: "ARGOCD_SYNCED",
      message: `ArgoCD synced ${deployment.stack.slug}`,
      metadata: { syncStatus: status.syncStatus },
    })
  }

  if (status.healthStatus === "Healthy") {
    const existingPodReady = await prisma.applicationDeployEvent.findFirst({
      where: {
        deploymentId: deployment.id,
        type: "POD_READY",
      },
    })
    if (!existingPodReady) {
      await recordDeployEvent({
        deploymentId: deployment.id,
        type: "POD_READY",
        message: `Pods ready for ${deployment.stack.slug}`,
        metadata: {
          syncStatus: status.syncStatus,
          healthStatus: status.healthStatus,
        },
      })
    }
    const existingCompleted = await prisma.applicationDeployEvent.findFirst({
      where: {
        deploymentId: deployment.id,
        type: "DEPLOY_COMPLETED",
      },
    })
    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "RUNNING",
        completedAt: new Date(),
      },
    })
    await prisma.applicationStack.update({
      where: { id: deployment.stackId },
      data: {
        status: "RUNNING",
        lastDeployStatus: "RUNNING",
        lastDeployedAt: new Date(),
      },
    })
    if (!existingCompleted) {
      await recordDeployEvent({
        deploymentId: deployment.id,
        type: "DEPLOY_COMPLETED",
        message: `Deployment completed for ${deployment.stack.slug}`,
        metadata: {
          syncStatus: status.syncStatus,
          healthStatus: status.healthStatus,
        },
      })
    }
    return { completed: true, status }
  }

  if (status.healthStatus === "Degraded") {
    await prisma.applicationDeployment.update({
      where: { id: deployment.id },
      data: {
        status: "FAILED",
        failureReason: "ArgoCD application degraded",
        completedAt: new Date(),
      },
    })
    await prisma.applicationStack.update({
      where: { id: deployment.stackId },
      data: { lastDeployStatus: "FAILED" },
    })
    await recordDeployEvent({
      deploymentId: deployment.id,
      type: "DEPLOY_FAILED",
      message: `ArgoCD application degraded for ${deployment.stack.slug}`,
      metadata: { healthStatus: status.healthStatus },
    })
    return { completed: true, status }
  }

  return { completed: false, status }
}
