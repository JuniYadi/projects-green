import { prisma } from "@/lib/prisma"
import { Prisma, type DeployEventType } from "@prisma/client"

export async function recordDeployEvent(params: {
  deploymentId: string
  type: DeployEventType
  message?: string
  metadata?: Record<string, unknown>
}) {
  return prisma.deployEvent.create({
    data: {
      deploymentId: params.deploymentId,
      type: params.type,
      message: params.message ?? null,
      metadataJson: (params.metadata as Prisma.InputJsonValue) ?? null,
    },
  })
}

export async function recordDeployLog(params: {
  deploymentId: string
  scope: string
  status: string
  message: string
}) {
  return prisma.deploymentLog.create({
    data: {
      deploymentId: params.deploymentId,
      scope: params.scope,
      status: params.status,
      message: params.message,
    },
  })
}

export async function getDeployEvents(deploymentId: string) {
  return prisma.deployEvent.findMany({
    where: { deploymentId },
    orderBy: { createdAt: "asc" },
  })
}

export async function getDeployLogs(deploymentId: string) {
  return prisma.deploymentLog.findMany({
    where: { deploymentId },
    orderBy: { timestamp: "asc" },
  })
}
