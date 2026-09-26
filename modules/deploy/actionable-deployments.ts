import { StackStatus, type Prisma } from "@prisma/client"

export const actionableDeploymentWhere: Prisma.ApplicationDeploymentWhereInput =
  {
    status: { in: [StackStatus.FAILED, StackStatus.BUILDING] },
    stack: { status: { not: StackStatus.TERMINATED } },
  }

type LatestDeploymentDelegate = {
  findMany: (
    args: Prisma.ApplicationDeploymentFindManyArgs
  ) => Promise<Array<{ id: string }>>
}

export async function getActionableDeploymentIds(
  deployment: LatestDeploymentDelegate
): Promise<string[]> {
  const latest = await deployment.findMany({
    distinct: ["stackId"],
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: { stack: { status: { not: StackStatus.TERMINATED } } },
    select: { id: true },
  })

  return latest.map(({ id }) => id)
}
