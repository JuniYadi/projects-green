import { prisma } from "@/lib/prisma"

export async function rollbackDeployment(params: {
  stackId: string
  targetDeploymentId: string
}) {
  // Wrap in transaction for atomicity
  const rollbackDeployment = await prisma.$transaction(async (tx) => {
    const targetDeployment = await tx.deployment.findUniqueOrThrow({
      where: { id: params.targetDeploymentId },
    })

    if (targetDeployment.stackId !== params.stackId) {
      throw new Error("Target deployment does not belong to this stack")
    }

    if (targetDeployment.status !== "RUNNING") {
      throw new Error("Can only rollback to a successful deployment")
    }

    const currentStack = await tx.applicationStack.findUniqueOrThrow({
      where: { id: params.stackId },
    })

    // Count previous non-rollback deployments to set attempt number
    const previousAttempts = await tx.deployment.count({
      where: { stackId: params.stackId, rollbackOfId: null },
    })

    // Create rollback deployment
    const rollback = await tx.deployment.create({
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
        attempt: previousAttempts + 1,
      },
    })

    await tx.deployEvent.create({
      data: {
        deploymentId: rollback.id,
        type: "ROLLBACK_STARTED",
        message: `Rolling back to deployment ${targetDeployment.id}`,
        metadataJson: {
          targetDeploymentId: targetDeployment.id,
          targetCommitSha: targetDeployment.commitSha,
        },
      },
    })

    await tx.applicationStack.update({
      where: { id: params.stackId },
      data: { status: "QUEUED" },
    })

    return rollback
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
