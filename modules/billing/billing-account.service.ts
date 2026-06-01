import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const ensureBillingAccountForOrg = async (params: {
  organizationId: string
  getOrganizationAction: (orgId: string) => Promise<{ id: string; name: string }>
}): Promise<Prisma.BillingAccountGetPayload<object>> => {
  const { organizationId, getOrganizationAction } = params

  // Verify org exists in WorkOS BEFORE transaction to avoid holding DB connection during external API call
  try {
    await getOrganizationAction(organizationId)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    throw new Error(
      `Failed to fetch organization ${organizationId} from WorkOS: ${message}`,
    )
  }

  return prisma.$transaction(async (tx) => {
    // Find or create BillingAccount
    let account = await tx.billingAccount.findUnique({
      where: { organizationId },
    })

    if (!account) {
      account = await tx.billingAccount.create({
        data: {
          organizationId,
          balance: new Prisma.Decimal(0),
          currency: "USD",
          timezone: "UTC",
          status: "ACTIVE",
        },
      })
    }

    return account
  })
}
