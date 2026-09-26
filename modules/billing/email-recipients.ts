import { createWorkOS } from "@workos-inc/node"
import type { BillingContactRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getCachedOrganization } from "@/lib/workos-directory"

export type BillingEmailRecipient = { email: string }

export type InvoiceBilledTo = {
  organizationName?: string
  billedToEmail?: string
}

// Owner-like/finance contacts are billed-to before generic ones.
const BILLING_CONTACT_ROLE_PRIORITY: Record<BillingContactRole, number> = {
  OWNER: 0,
  FINANCE: 1,
  ACCOUNTING: 2,
  GENERAL: 3,
}

export async function resolveInvoiceEmailRecipients(
  organizationId: string
): Promise<BillingEmailRecipient[]> {
  const recipients: BillingEmailRecipient[] = []

  const account = await prisma.billingAccount.findUnique({
    where: { organizationId },
    include: {
      contacts: { where: { isActive: true, notifyOnInvoice: true } },
    },
  })

  for (const contact of account?.contacts ?? []) {
    recipients.push({ email: contact.email })
  }
  // Resolve all Platform Users directly from AuthPlatformUserRole table
  try {
    const platformUsers = await prisma.authPlatformUserRole.findMany({
      where: {
        email: { not: null },
      },
      select: { email: true },
    })

    for (const { email } of platformUsers) {
      if (email && !recipients.some((r) => r.email === email)) {
        recipients.push({ email })
      }
    }
  } catch (error) {
    console.error(
      "[BillingEmailRecipients] Failed to resolve platform users:",
      error
    )
  }

  try {
    const workos = createWorkOS({ apiKey: process.env.WORKOS_API_KEY ?? "" })
    const memberships = await workos.userManagement
      .listOrganizationMemberships({
        organizationId,
        statuses: ["active"],
      })
      .then((response) => response.autoPagination())

    const admin = memberships.find((membership) => {
      const slug = membership.role?.slug?.toLowerCase()
      return slug === "user_owner" || slug === "user_admin"
    })

    if (admin?.userId) {
      const user = await workos.userManagement.getUser(admin.userId)
      if (user.email && !recipients.some((r) => r.email === user.email)) {
        recipients.push({ email: user.email })
      }
    }
  } catch (error) {
    console.error(
      `[BillingEmailRecipients] Failed to resolve admin email for org ${organizationId}:`,
      error
    )
  }
  return recipients
}

/**
 * Resolve the org/billing identity ("Billed To") shown on invoice emails.
 * Never throws — logs and returns whatever could be resolved so a lookup
 * failure never blocks sending the underlying invoice email.
 */
export async function resolveInvoiceBilledTo(
  organizationId: string,
  fallbackEmail?: string | null
): Promise<InvoiceBilledTo> {
  let organizationName: string | undefined
  try {
    organizationName =
      (await getCachedOrganization(organizationId))?.name ?? undefined
  } catch (error) {
    console.error(
      `[BillingEmailRecipients] Failed to resolve organization name for org ${organizationId}:`,
      error
    )
  }

  let billedToEmail: string | undefined
  try {
    const account = await prisma.billingAccount.findUnique({
      where: { organizationId },
      include: {
        contacts: { where: { isActive: true, notifyOnInvoice: true } },
      },
    })

    const primaryContact = [...(account?.contacts ?? [])].sort((a, b) => {
      const roleDiff =
        BILLING_CONTACT_ROLE_PRIORITY[a.role] -
        BILLING_CONTACT_ROLE_PRIORITY[b.role]
      if (roleDiff !== 0) return roleDiff

      const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime()
      if (createdAtDiff !== 0) return createdAtDiff

      return a.email.localeCompare(b.email)
    })[0]

    billedToEmail = primaryContact?.email ?? fallbackEmail ?? undefined
  } catch (error) {
    console.error(
      `[BillingEmailRecipients] Failed to resolve billing contact for org ${organizationId}:`,
      error
    )
    billedToEmail = fallbackEmail ?? undefined
  }

  return { organizationName, billedToEmail }
}
