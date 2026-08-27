import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { AppHostingBillingService } from "./billing/app-hosting-billing.service"
import { resolveAppHostingClusterForStack } from "./cluster-integration.service"

type BillingGate = Pick<
  AppHostingBillingService,
  "assertCanStartPayg" | "assertCanDeploySubscription"
>
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
  const billing =
    dependencies.billing ??
    new AppHostingBillingService(prisma, new BillingTransactionService(prisma))

  if (input.billingMode === "PAYG") {
    await billing.assertCanStartPayg({
      organizationId: input.organizationId,
      hourlyCost: new Prisma.Decimal(String(input.hourlyCost)),
      bufferHours: input.paygBufferHours,
    })
  } else {
    await billing.assertCanDeploySubscription({
      organizationId: input.organizationId,
      stackId: input.stackId,
    })
  }

  await (dependencies.resolveCluster ?? resolveAppHostingClusterForStack)(
    input.stackId
  )
}
