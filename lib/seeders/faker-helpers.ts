/**
 * Faker Helpers
 *
 * Common faker utilities for generating Prisma-compatible seed data.
 * Uses @faker-js/faker for realistic test data generation.
 *
 * All helpers return plain objects compatible with Prisma create/upsert
 * input types. Import Prisma types from @prisma/client in your seeder
 * and pass these helpers' output directly.
 *
 * Example:
 *   import { Prisma, BillingInvoiceStatus } from "@prisma/client"
 *   import { fakerInvoice, fakerInvoiceLine } from "@/lib/seeders/faker-helpers"
 *
 *   const invoiceData = fakerInvoice({
 *     billingAccount: { connect: { id: billingAccount.id } },
 *     status: InvoiceStatus.OPEN,
 *   })
 */

import { faker } from "@faker-js/faker"
import {
  type Prisma,
  BillingInvoiceStatus,
  BillingInvoiceLineType,
  SupportTicketDepartment,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketService,
  BillingAccountStatus,
  BillingSubscriptionStatus,
  VpnClientStatus,
  VpnProvider,
  VpnRegionCode,
  WhatsappDeviceStatus,
  WhatsappContactStatus,
  WhatsappContactGroupType,
  WhatsappContactGroupStatus,
  WhatsappMessageDirection,
} from "@prisma/client"

// ── Re-export faker instance ────────────────────────────────────────────────

export { faker }

// ── Common Fields ───────────────────────────────────────────────────────────

/**
 * Generate a cuid-like ID (25 chars, starts with 'c').
 * Use when your seeder needs a deterministic-looking ID.
 */
export function fakerId(): string {
  return faker.string.uuid()
}

/**
 * Generate a recent past date within the given number of days.
 */
export function fakerRecentDate(daysBack = 30): Date {
  return faker.date.recent({ days: daysBack })
}

/**
 * Generate a random money amount as a string.
 * Returns values between 0.01 and 10,000 by default.
 * Use for Prisma Decimal fields.
 */
export function fakerAmount(min = 0.01, max = 10_000): string {
  return faker.finance.amount({ min, max, dec: 2 })
}

/**
 * Generate a random past date range pair (start, end).
 */
export function fakerDateRange(maxDaysBack = 90): {
  start: Date
  end: Date
} {
  const end = faker.date.recent({ days: 7 })
  const start = faker.date.recent({ days: maxDaysBack })
  return { start: start < end ? start : end, end: start < end ? end : start }
}

// ── Billing Helpers ─────────────────────────────────────────────────────────

/**
 * Generate a BillingAccount create input.
 * Requires `organizationId` to be provided explicitly.
 */
export function fakerBillingAccount(
  overrides: Partial<Prisma.BillingAccountCreateInput> & {
    organizationId: string
  },
): Prisma.BillingAccountCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    organizationId: overrides.organizationId,
    status: overrides.status ?? faker.helpers.enumValue(BillingAccountStatus),
    preferredCurrency: overrides.preferredCurrency ?? "USD",
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

/**
 * Generate a BillingSubscription create input.
 * Requires `billingAccount` relation connect.
 */
export function fakerBillingSubscription(
  overrides: Partial<Prisma.BillingSubscriptionCreateInput>,
): Prisma.BillingSubscriptionCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    billingAccount:
      overrides.billingAccount ?? { connect: { id: fakerId() } },
    status:
      overrides.status ?? faker.helpers.enumValue(BillingSubscriptionStatus),
    startedAt: overrides.startedAt ?? fakerRecentDate(60),
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

// ── Invoice Helpers ─────────────────────────────────────────────────────────

/**
 * Generate invoice number in a standard format.
 */
export function fakerInvoiceNumber(): string {
  const year = new Date().getFullYear()
  const seq = faker.string.numeric(5)
  return `INV-${year}-${seq}`
}

/**
 * Generate an Invoice create input.
 * Requires `billingAccount` relation connect.
 */
export function fakerInvoice(
  overrides: Partial<Prisma.BillingInvoiceCreateInput>,
): Prisma.BillingInvoiceCreateInput {
  const range = fakerDateRange()
  return {
    id: overrides.id ?? fakerId(),
    invoiceNumber: overrides.invoiceNumber ?? fakerInvoiceNumber(),
    billingAccount: overrides.billingAccount ?? { connect: { id: fakerId() } },
    status: overrides.status ?? faker.helpers.enumValue(BillingInvoiceStatus),
    currency: overrides.currency ?? "USD",
    subtotalAmount: overrides.subtotalAmount ?? fakerAmount(10, 5_000),
    taxAmount: overrides.taxAmount ?? fakerAmount(0, 500),
    discountAmount: overrides.discountAmount ?? fakerAmount(0, 200),
    totalAmount: overrides.totalAmount ?? fakerAmount(10, 5_500),
    periodStart: overrides.periodStart ?? range.start,
    periodEnd: overrides.periodEnd ?? range.end,
    dueAt: overrides.dueAt ?? faker.date.soon({ days: 30 }),
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

/**
 * Generate an InvoiceLine create input.
 * Requires `invoice` relation connect.
 */
export function fakerInvoiceLine(
  overrides: Partial<Prisma.BillingInvoiceLineCreateInput>,
): Prisma.BillingInvoiceLineCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    invoice: overrides.invoice ?? { connect: { id: fakerId() } },
    lineType: overrides.lineType ?? faker.helpers.enumValue(BillingInvoiceLineType),
    description: overrides.description ?? faker.commerce.productName(),
    quantity:
      overrides.quantity ??
      faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
    unitPrice: overrides.unitPrice ?? fakerAmount(1, 500),
    amount: overrides.amount ?? fakerAmount(10, 5_000),
    currency: overrides.currency ?? "USD",
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

// ── Support Ticket Helpers ──────────────────────────────────────────────────

/**
 * Generate a support ticket number.
 */
export function fakerTicketNumber(): string {
  return `TKT-${faker.string.numeric(6)}`
}

/**
 * Generate a SupportTicket create input.
 * Requires `organizationId` and `requesterWorkosUserId`.
 */
export function fakerSupportTicket(
  overrides: Partial<Prisma.SupportTicketCreateInput> & {
    organizationId: string
    requesterWorkosUserId: string
  },
): Prisma.SupportTicketCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    ticketNumber: overrides.ticketNumber ?? fakerTicketNumber(),
    organizationId: overrides.organizationId,
    requesterWorkosUserId: overrides.requesterWorkosUserId,
    department:
      overrides.department ?? faker.helpers.enumValue(SupportTicketDepartment),
    priority:
      overrides.priority ?? faker.helpers.enumValue(SupportTicketPriority),
    service: overrides.service ?? faker.helpers.enumValue(SupportTicketService),
    status: overrides.status ?? faker.helpers.enumValue(SupportTicketStatus),
    subject: overrides.subject ?? faker.lorem.sentence(),
    description: overrides.description ?? faker.lorem.paragraphs(2),
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

/**
 * Generate a SupportTicketReply create input.
 * Requires `ticket` relation connect and `authorWorkosUserId`.
 */
export function fakerSupportTicketReply(
  overrides: Partial<Prisma.SupportTicketReplyCreateInput> & {
    authorWorkosUserId: string
  },
): Prisma.SupportTicketReplyCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    ticket: overrides.ticket ?? { connect: { id: fakerId() } },
    authorWorkosUserId: overrides.authorWorkosUserId,
    body: overrides.body ?? faker.lorem.paragraph(),
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

// ── VPN Helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a VpnClient create input.
 * Requires `organizationId` and `subscription` relation connect.
 */
export function fakerVpnClient(
  overrides: Partial<Prisma.VpnClientCreateInput> & {
    organizationId: string
  },
): Prisma.VpnClientCreateInput {
  const range = fakerDateRange(30)
  return {
    id: overrides.id ?? fakerId(),
    organizationId: overrides.organizationId,
    subscription: overrides.subscription ?? { connect: { id: fakerId() } },
    provider: overrides.provider ?? VpnProvider.OPENVPN,
    regionCode: overrides.regionCode ?? VpnRegionCode.INDONESIA,
    clientName:
      overrides.clientName ?? `vpn-${faker.internet.username()}-${faker.string.alphanumeric(4)}`,
    status: overrides.status ?? faker.helpers.enumValue(VpnClientStatus),
    currentPeriodStart: overrides.currentPeriodStart ?? range.start,
    currentPeriodEnd: overrides.currentPeriodEnd ?? range.end,
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

// ── WhatsApp Helpers ────────────────────────────────────────────────────────

/**
 * Generate a random phone number for WhatsApp.
 */
export function fakerPhoneNumber(): string {
  return faker.phone.number()
}

/**
 * Generate a WhatsappDevice create input.
 * Requires `organizationId` and `phoneNumber`.
 */
export function fakerWhatsappDevice(
  overrides: Partial<Prisma.WhatsappDeviceCreateInput> & {
    organizationId: string
    phoneNumber: string
  },
): Prisma.WhatsappDeviceCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    organizationId: overrides.organizationId,
    phoneNumber: overrides.phoneNumber,
    status:
      overrides.status ?? faker.helpers.enumValue(WhatsappDeviceStatus),
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

/**
 * Generate a WhatsappContactGroup create input.
 * Requires `organizationId`.
 */
export function fakerWhatsappContactGroup(
  overrides: Partial<Prisma.WhatsappContactGroupCreateInput> & {
    organizationId: string
  },
): Prisma.WhatsappContactGroupCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    organizationId: overrides.organizationId,
    name: overrides.name ?? faker.company.name(),
    description: overrides.description ?? faker.lorem.sentence(),
    type: overrides.type ?? WhatsappContactGroupType.STATIC,
    status: overrides.status ?? WhatsappContactGroupStatus.ACTIVE,
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

/**
 * Generate a WhatsappContact create input.
 * Requires `organizationId`, `phoneNumber`, and `contactGroup` relation connect.
 */
export function fakerWhatsappContact(
  overrides: Partial<Prisma.WhatsappContactCreateInput> & {
    organizationId: string
    phoneNumber: string
  },
): Prisma.WhatsappContactCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    organizationId: overrides.organizationId,
    phoneNumber: overrides.phoneNumber,
    name: overrides.name ?? faker.person.fullName(),
    email: overrides.email ?? faker.internet.email(),
    status:
      overrides.status ?? faker.helpers.enumValue(WhatsappContactStatus),
    contactGroup: overrides.contactGroup ?? { connect: { id: fakerId() } },
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

/**
 * Generate a WhatsappMessage create input.
 * Requires `conversation` relation connect and `direction`.
 */
export function fakerWhatsappMessage(
  overrides: Partial<Prisma.WhatsappMessageCreateInput>,
): Prisma.WhatsappMessageCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    conversation: overrides.conversation ?? { connect: { id: fakerId() } },
    direction:
      overrides.direction ?? faker.helpers.enumValue(WhatsappMessageDirection),
    messageType: overrides.messageType ?? "text",
    body: overrides.body ?? faker.lorem.sentence(),
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

// ── Knowledge Document Helpers ──────────────────────────────────────────────

/**
 * Generate a DocsKnowledgeDocument create input.
 * Requires `updatedByWorkosUserId`.
 */
export function fakerKnowledgeDocument(
  overrides: Partial<Prisma.DocsKnowledgeDocumentCreateInput> & {
    updatedByWorkosUserId: string
  },
): Prisma.DocsKnowledgeDocumentCreateInput {
  return {
    id: overrides.id ?? fakerId(),
    organizationId: overrides.organizationId ?? null,
    path: overrides.path ?? `docs/${faker.system.fileName()}.md`,
    title: overrides.title ?? faker.lorem.sentence(),
    purpose: overrides.purpose ?? faker.lorem.paragraph(),
    howTo: overrides.howTo ?? [faker.lorem.sentence()],
    notes: overrides.notes ?? [faker.lorem.sentence()],
    searchText: overrides.searchText ?? faker.lorem.words(20),
    embedding: overrides.embedding ?? [],
    updatedByWorkosUserId: overrides.updatedByWorkosUserId,
    createdAt: overrides.createdAt ?? fakerRecentDate(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }
}

// ── Array Helpers ───────────────────────────────────────────────────────────

/**
 * Generate an array of items using a factory function.
 * Useful for creating multiple records at once.
 *
 * Example:
 *   const contacts = fakerArray(10, (i) =>
 *     fakerWhatsappContact({
 *       organizationId: org.id,
 *       phoneNumber: fakerPhoneNumber(),
 *       name: `Contact ${i}`,
 *     })
 *   )
 */
export function fakerArray<T>(
  count: number,
  factory: (index: number) => T,
): T[] {
  return Array.from({ length: count }, (_, i) => factory(i))
}

/**
 * Pick a random subset of items from an array.
 */
export function fakerPick<T>(items: readonly T[], count = 1): T[] {
  return faker.helpers.arrayElements(items, count)
}

/**
 * Generate a random slug-like string.
 */
export function fakerSlug(): string {
  return faker.helpers.slugify(faker.lorem.words(3)).toLowerCase()
}
