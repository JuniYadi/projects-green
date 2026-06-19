import { Prisma, PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export const ensureBillingAccountForOrg = async (params: {
  organizationId: string
  getOrganizationAction: (
    orgId: string
  ) => Promise<{ id: string; name: string }>
  currency?: "IDR" | "USD"
}): Promise<Prisma.BillingAccountGetPayload<object>> => {
  const { organizationId, getOrganizationAction, currency } = params

  // Verify org exists in WorkOS BEFORE transaction to avoid holding DB connection during external API call
  try {
    await getOrganizationAction(organizationId)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    throw new Error(
      `Failed to fetch organization ${organizationId} from WorkOS: ${message}`
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
          preferredCurrency: currency === "USD" ? "USD" : "IDR",
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
  billingAccountId: string
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
  newCurrency: "IDR" | "USD"
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
    data: { preferredCurrency: newCurrency },
  })
}

// ─── Billing Contacts ─────────────────────────────────────────────────────────

export type CreateContactParams = {
  billingAccountId: string
  email: string
  name?: string | null
  role?: "FINANCE" | "ACCOUNTING" | "GENERAL"
  notifyOnInvoice?: boolean
  notifyOnLowBalance?: boolean
  notifyOnSupport?: boolean
}

export type UpdateContactParams = {
  name?: string | null
  notifyOnInvoice?: boolean
  notifyOnLowBalance?: boolean
  notifyOnSupport?: boolean
  isActive?: boolean
}

/**
 * Get or create a billing account with billing contacts.
 * On first access, pre-fills the OWNER contact with the current user's email.
 */
export async function getOrCreateAccountWithContacts(params: {
  organizationId: string
  userEmail: string
}): Promise<Prisma.BillingAccountGetPayload<{ include: { contacts: true } }>> {
  const { organizationId, userEmail } = params

  // Find or create account
  const account = await prisma.billingAccount.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
    include: { contacts: true },
  })

  // Prefill OWNER contact if no contacts exist yet
  if (account.contacts.length === 0) {
    await prisma.billingContact.create({
      data: {
        billingAccountId: account.id,
        email: userEmail,
        name: "Organization Owner",
        role: "OWNER",
        notifyOnInvoice: true,
        notifyOnLowBalance: true,
        notifyOnSupport: true,
        isActive: true,
      },
    })
    // Refetch with new contact
    return prisma.billingAccount.findUniqueOrThrow({
      where: { id: account.id },
      include: { contacts: true },
    })
  }

  return account
}

/**
 * Add a new billing contact to an account.
 * Fails if email already exists for this billing account.
 */
export async function addBillingContact(
  params: CreateContactParams
): Promise<Prisma.BillingContactGetPayload<object>> {
  return prisma.billingContact.create({
    data: {
      billingAccountId: params.billingAccountId,
      email: params.email,
      name: params.name ?? null,
      role: params.role ?? "GENERAL",
      notifyOnInvoice: params.notifyOnInvoice ?? true,
      notifyOnLowBalance: params.notifyOnLowBalance ?? true,
      notifyOnSupport: params.notifyOnSupport ?? true,
    },
  })
}

/**
 * Update a billing contact. OWNER contacts are protected from email/role changes.
 * Throws if contact is not found or doesn't belong to the billing account.
 */
export async function updateBillingContact(
  billingAccountId: string,
  contactId: string,
  input: UpdateContactParams
): Promise<Prisma.BillingContactGetPayload<object>> {
  // Verify ownership
  const contact = await prisma.billingContact.findFirst({
    where: {
      id: contactId,
      billingAccount: { organizationId: billingAccountId },
    },
  })

  if (!contact) {
    throw new Error("CONTACT_NOT_FOUND")
  }

  // Protect OWNER contact — cannot change email or role (but notification toggles are editable)
  // Per-notification toggles are intentionally NOT blocked here — OWNER may opt out of specific email types.
  if (contact.role === "OWNER") {
    // name and isActive are editable for OWNER too
  }

  return prisma.billingContact.update({
    where: { id: contactId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.notifyOnInvoice !== undefined && {
        notifyOnInvoice: input.notifyOnInvoice,
      }),
      ...(input.notifyOnLowBalance !== undefined && {
        notifyOnLowBalance: input.notifyOnLowBalance,
      }),
      ...(input.notifyOnSupport !== undefined && {
        notifyOnSupport: input.notifyOnSupport,
      }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  })
}

/**
 * Deactivate (soft-delete) a billing contact.
 * OWNER contacts are protected from deletion.
 * Throws CONTACT_NOT_FOUND or OWNER_PROTECTED.
 */
export async function deactivateBillingContact(
  billingAccountId: string,
  contactId: string
): Promise<void> {
  const contact = await prisma.billingContact.findFirst({
    where: {
      id: contactId,
      billingAccount: { organizationId: billingAccountId },
    },
  })

  if (!contact) {
    throw new Error("CONTACT_NOT_FOUND")
  }

  if (contact.role === "OWNER") {
    throw new Error("OWNER_PROTECTED")
  }

  await prisma.billingContact.update({
    where: { id: contactId },
    data: { isActive: false },
  })
}

/**
 * Check if an organization has any invoices (financial transactions).
 * Used to gate currency changes.
 */
export async function hasInvoices(organizationId: string): Promise<boolean> {
  const count = await prisma.billingInvoice.count({
    where: { billingAccount: { organizationId } },
  })
  return count > 0
}

/**
 * Update preferred currency for a billing account.
 * Throws BILLING_CURRENCY_LOCKED if invoices exist.
 */
export async function updatePreferredCurrency(
  organizationId: string,
  currency: "USD" | "IDR"
): Promise<Prisma.BillingAccountGetPayload<object>> {
  const account = await prisma.billingAccount.findUnique({
    where: { organizationId },
  })

  if (!account) {
    throw new Error("BILLING_ACCOUNT_NOT_FOUND")
  }

  if (await hasInvoices(organizationId)) {
    throw new Error("BILLING_CURRENCY_LOCKED")
  }

  return prisma.billingAccount.update({
    where: { organizationId },
    // Write `currency` (the single source of truth used by dashboard, topup,
    // and all transaction logic) and keep the legacy `preferredCurrency` enum
    // in sync so any remaining readers stay consistent.
    data: { currency, preferredCurrency: currency },
  })
}

/**
 * Update alert preferences for a billing account.
 * Preferences are stored in metadataJson and include balance/usage thresholds.
 */
export async function updateAlertPreferences(
  organizationId: string,
  prefs: Record<string, unknown>
): Promise<Prisma.BillingAccountGetPayload<{ include: { contacts: true } }>> {
  const account = await prisma.billingAccount.findUnique({
    where: { organizationId },
  })

  if (!account) {
    throw new Error("BILLING_ACCOUNT_NOT_FOUND")
  }

  const currentMeta =
    account.metadataJson && typeof account.metadataJson === "object"
      ? (account.metadataJson as Record<string, unknown>)
      : {}

  return prisma.billingAccount.update({
    where: { organizationId },
    data: {
      metadataJson: {
        ...currentMeta,
        alertPreferences: {
          ...((currentMeta.alertPreferences as Record<string, unknown>) ?? {}),
          ...prefs,
        },
      } as Prisma.InputJsonValue,
    },
    include: { contacts: true },
  })
}
