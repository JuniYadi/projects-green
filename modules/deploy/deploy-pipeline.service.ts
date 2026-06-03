import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { recordDeployEvent } from "./deploy-event.service"

export async function triggerDeploy(params: {
  stackId: string
  triggerType?: "MANUAL" | "GITHUB" | "TEMPLATE"
}) {
  // Count previous non-rollback deployments to set attempt number
  const previousAttempts = await prisma.deployment.count({
    where: { stackId: params.stackId, rollbackOfId: null },
  })

  // Use transaction to prevent race condition between status check and create
  const deployment = await prisma.$transaction(async (tx) => {
    const stack = await tx.applicationStack.findUniqueOrThrow({
      where: { id: params.stackId },
    })

    if (stack.status === "QUEUED" || stack.status === "BUILDING" || stack.status === "DEPLOYING") {
      throw new Error("A deployment is already in progress for this stack")
    }

    const newDeployment = await tx.deployment.create({
      data: {
        stackId: params.stackId,
        organizationId: stack.organizationId,
        status: "QUEUED",
        triggerType: params.triggerType ?? "MANUAL",
        commitSha: null,
        commitMessage: null,
        commitAuthor: null,
        branchName: stack.branchName,
        attempt: previousAttempts + 1,
      },
    })

    await tx.deployEvent.create({
      data: {
        deploymentId: newDeployment.id,
        type: "QUEUED",
        message: "Deployment queued",
        metadataJson: Prisma.JsonNull,
      },
    })

    await tx.applicationStack.update({
      where: { id: params.stackId },
      data: { status: "QUEUED" },
    })

    return newDeployment
  })

  return { deploymentId: deployment.id, status: "QUEUED" as const }
}
