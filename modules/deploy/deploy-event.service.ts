import { prisma } from "@/lib/prisma"
import { Prisma, type ApplicationDeployEventType } from "@prisma/client"

type PrismaClient = Prisma.TransactionClient

export async function recordDeployEvent(
  params: {
    deploymentId: string
    type: ApplicationDeployEventType
    message?: string
    metadata?: Record<string, unknown>
  },
  db: PrismaClient = prisma
) {
  return db.applicationDeployEvent.create({
    data: {
      deploymentId: params.deploymentId,
      type: params.type,
      message: params.message ?? null,
      metadataJson: (params.metadata as Prisma.InputJsonValue) ?? null,
    },
  })
}

export async function recordDeployLog(
  params: {
    deploymentId: string
    scope: string
    status: string
    message: string
  },
  db: PrismaClient = prisma
) {
  return db.applicationDeploymentLog.create({
    data: {
      deploymentId: params.deploymentId,
      scope: params.scope,
      status: params.status,
      message: params.message,
    },
  })
}

export async function getDeployEvents(deploymentId: string) {
  return prisma.applicationDeployEvent.findMany({
    where: { deploymentId },
    orderBy: { createdAt: "asc" },
  })
}

export async function getDeployLogs(deploymentId: string) {
  return prisma.applicationDeploymentLog.findMany({
    where: { deploymentId },
    orderBy: { timestamp: "asc" },
  })
}
