import { createWorkOS } from "@workos-inc/node"

import { prisma } from "@/lib/prisma"

export type BillingEmailRecipient = { email: string }

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
