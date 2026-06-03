import { prisma } from "@/lib/prisma"
import { recordDeployEvent } from "./deploy-event.service"

export async function triggerDeploy(params: {
  stackId: string
  triggerType?: "MANUAL" | "GITHUB" | "TEMPLATE"
}) {
  const stack = await prisma.applicationStack.findUniqueOrThrow({
    where: { id: params.stackId },
  })

  if (stack.status === "QUEUED" || stack.status === "BUILDING" || stack.status === "DEPLOYING") {
    throw new Error("A deployment is already in progress for this stack")
  }

  const deployment = await prisma.deployment.create({
    data: {
      stackId: params.stackId,
      organizationId: stack.organizationId,
      status: "QUEUED",
      triggerType: params.triggerType ?? "MANUAL",
      commitSha: null,
      commitMessage: null,
      commitAuthor: null,
      branchName: stack.branchName,
    },
  })

  await recordDeployEvent({
    deploymentId: deployment.id,
    type: "QUEUED",
    message: "Deployment queued",
  })

  await prisma.applicationStack.update({
    where: { id: params.stackId },
    data: { status: "QUEUED" },
  })

  return { deploymentId: deployment.id, status: "QUEUED" as const }
}
