import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type WorkOSOrganization = {
  id: string
  name: string
}

export const ensureBillingAccountForOrg = async (params: {
  organizationId: string
  getOrganizationAction: (orgId: string) => Promise<WorkOSOrganization>
}): Promise<Prisma.BillingAccountGetPayload<object>> => {
  const { organizationId, getOrganizationAction } = params

  // Fetch org name BEFORE transaction to avoid holding DB connection during external API call
  let org: WorkOSOrganization
  try {
    org = await getOrganizationAction(organizationId)
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
