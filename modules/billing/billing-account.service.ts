import { Prisma, PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const ensureBillingAccountForOrg = async (params: {
  organizationId: string
  getOrganizationAction: (orgId: string) => Promise<{ id: string; name: string }>
  currency?: "IDR" | "USD"
}): Promise<Prisma.BillingAccountGetPayload<object>> => {
  const { organizationId, getOrganizationAction, currency } = params

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
          currency: currency ?? "IDR",
          timezone: "UTC",
          status: "ACTIVE",
        },
      })
    }

    return account
  })
}

/**
 * Check if a billing account is "clean" — no financial records exist and balance is zero.
 * A clean account is the only state where currency can be changed.
 */
export async function isBillingAccountClean(
  prismaClient: PrismaClient,
  billingAccountId: string,
): Promise<boolean> {
  const account = await prismaClient.billingAccount.findUnique({
    where: { id: billingAccountId },
    include: {
      invoices: { take: 1 },
      adjustments: { take: 1 },
      subscriptions: { take: 1 },
    },
  })
  if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
  return (
    account.balance.eq(0) &&
    account.invoices.length === 0 &&
    account.adjustments.length === 0 &&
    account.subscriptions.length === 0
  )
}

/**
 * Update billing currency only if the account is clean.
 * Throws BILLING_CURRENCY_LOCKED if any financial record exists.
 */
export async function updateBillingCurrencyIfClean(
  prismaClient: PrismaClient,
  organizationId: string,
  newCurrency: "IDR" | "USD",
): Promise<Prisma.BillingAccountGetPayload<object>> {
  const account = await prismaClient.billingAccount.findUnique({
    where: { organizationId },
  })
  if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")
  if (!(await isBillingAccountClean(prismaClient, account.id))) {
    throw new Error("BILLING_CURRENCY_LOCKED")
  }
  return prismaClient.billingAccount.update({
    where: { id: account.id },
    data: { currency: newCurrency },
  })
}
