import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { AppHostingBillingService } from "./billing/app-hosting-billing.service"
import { resolveAppHostingClusterForStack } from "./cluster-integration.service"

type BillingGate = Pick<AppHostingBillingService, "assertCanStartPayg">
type ClusterResolver = typeof resolveAppHostingClusterForStack

export type DeployExecutionGateInput = {
  organizationId: string
  stackId: string
  billingMode: "PAYG" | "PACKAGE"
  resourcePlanId: string | null
  hourlyCost: number
  paygBufferHours: number
}

export type DeployExecutionGateDependencies = {
  billing?: BillingGate
  resolveCluster?: ClusterResolver
}

export async function assertDeployExecutionGates(
  input: DeployExecutionGateInput,
  dependencies: DeployExecutionGateDependencies = {}
): Promise<void> {
  if (input.billingMode === "PAYG" && input.resourcePlanId === "payg") {
    const billing =
      dependencies.billing ??
      new AppHostingBillingService(
        prisma,
        new BillingTransactionService(prisma)
      )
    await billing.assertCanStartPayg({
      organizationId: input.organizationId,
      hourlyCost: new Prisma.Decimal(String(input.hourlyCost)),
      bufferHours: input.paygBufferHours,
    })
  }

  await (dependencies.resolveCluster ?? resolveAppHostingClusterForStack)(
    input.stackId
  )
}
