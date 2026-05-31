import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

type WorkOSOrganization = {
  id: string
  name: string
}

export const ensureBillingAccountForOrg = async (params: {
  organizationId: string
  getOrganizationAction: (orgId: string) => Promise<WorkOSOrganization>
}): Promise<Prisma.BillingAccountGetPayload<{ include: { tenant: true } }>> => {
  const { organizationId, getOrganizationAction } = params

  return prisma.$transaction(async (tx) => {
    // 1. Find or create Tenant
    let tenant = await tx.tenant.findUnique({
      where: { code: organizationId },
    })

    if (!tenant) {
      // Fetch org name from WorkOS
      let org: WorkOSOrganization
      try {
        org = await getOrganizationAction(organizationId)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        throw new Error(
          `Failed to fetch organization ${organizationId} from WorkOS: ${message}`,
        )
      }

      tenant = await tx.tenant.create({
        data: {
          code: organizationId,
          name: org.name,
        },
      })
    }

    // 2. Find or create BillingAccount
    let account = await tx.billingAccount.findUnique({
      where: { organizationId },
      include: { tenant: true },
    })

    if (!account) {
      account = await tx.billingAccount.create({
        data: {
          tenantId: tenant.id,
          organizationId,
          balance: new Prisma.Decimal(0),
          currency: "USD",
          timezone: "UTC",
        },
        include: { tenant: true },
      })
    }

    return account
  })
}
