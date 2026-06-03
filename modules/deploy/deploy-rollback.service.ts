import { prisma } from "@/lib/prisma"
import { recordDeployEvent } from "./deploy-event.service"

export async function rollbackDeployment(params: {
  stackId: string
  targetDeploymentId: string
}) {
  const targetDeployment = await prisma.deployment.findUniqueOrThrow({
    where: { id: params.targetDeploymentId },
  })

  if (targetDeployment.stackId !== params.stackId) {
    throw new Error("Target deployment does not belong to this stack")
  }

  if (targetDeployment.status !== "RUNNING") {
    throw new Error("Can only rollback to a successful deployment")
  }

  const currentStack = await prisma.applicationStack.findUniqueOrThrow({
    where: { id: params.stackId },
  })

  // Create rollback deployment
  const rollbackDeployment = await prisma.deployment.create({
    data: {
      stackId: params.stackId,
      organizationId: currentStack.organizationId,
      status: "QUEUED",
      triggerType: "MANUAL",
      commitSha: targetDeployment.commitSha,
      commitMessage: `Rollback to deployment ${targetDeployment.id}`,
      commitAuthor: "system",
      branchName: targetDeployment.branchName,
      rollbackOfId: targetDeployment.id,
    },
  })

  await recordDeployEvent({
    deploymentId: rollbackDeployment.id,
    type: "ROLLBACK_STARTED",
    message: `Rolling back to deployment ${targetDeployment.id}`,
    metadata: {
      targetDeploymentId: targetDeployment.id,
      targetCommitSha: targetDeployment.commitSha,
    },
  })

  await prisma.applicationStack.update({
    where: { id: params.stackId },
    data: { status: "QUEUED" },
  })

  return { deploymentId: rollbackDeployment.id, status: "QUEUED" as const }
}

export async function getRollbackOptions(stackId: string) {
  return prisma.deployment.findMany({
    where: {
      stackId,
      status: "RUNNING",
    },
    orderBy: { completedAt: "desc" },
    take: 10,
    select: {
      id: true,
      commitSha: true,
      commitMessage: true,
      commitAuthor: true,
      branchName: true,
      completedAt: true,
      createdAt: true,
    },
  })
}
