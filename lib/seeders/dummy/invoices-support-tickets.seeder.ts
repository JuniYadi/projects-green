/**
 * Invoices & Support Tickets Dummy Seeder
 *
 * Migrated from scripts/seed-invoices-support-tickets.ts.
 * Creates demo invoices and support tickets for a given organization.
 *
 * Required CLI args (passed via seed-runner):
 *   --organization-id=<id>
 *   --requester-workos-user-id=<id>
 */

import { createHash } from "node:crypto"

import {
  BillingInvoiceLineType,
  BillingInvoiceStatus,
  Prisma,
  SupportTicketDepartment,
  SupportTicketPriority,
  SupportTicketService,
  SupportTicketStatus,
} from "@prisma/client"

import { BaseSeeder } from "../base-seeder"
import { registerSeeder } from "../registry"

// ── Internal Types ─────────────────────────────────────────────────────────

interface InvoiceLineSeed {
  lineType: BillingInvoiceLineType
  description: string
  quantity: number
  unitPrice: number
}

interface InvoiceSeed {
  key: string
  status: BillingInvoiceStatus
  periodStart: Date
  periodEnd: Date
  issuedAt: Date | null
  dueAt: Date | null
  paidAt: Date | null
  lines: InvoiceLineSeed[]
}

interface SupportTicketSeed {
  key: string
  status: SupportTicketStatus
  department: SupportTicketDepartment
  priority: SupportTicketPriority
  service: SupportTicketService | null
  subject: string
  description: string
  createdAt: Date
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SEED_TAG = "console-demo-v1"

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(6))

const sumNumbers = (values: number[]) =>
  values.reduce((total, current) => total + current, 0)

const toScopedSeedCode = (organizationId: string) =>
  createHash("sha1")
    .update(organizationId.trim())
    .digest("hex")
    .slice(0, 8)
    .toUpperCase()

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const buildInvoiceTotals = (
  lines: Array<{ lineType: BillingInvoiceLineType; amount: number }>,
) => {
  const subtotalAmount = sumNumbers(
    lines
      .filter((l) => l.lineType !== "TAX" && l.lineType !== "CREDIT")
      .map((l) => l.amount),
  )
  const taxAmount = sumNumbers(
    lines.filter((l) => l.lineType === "TAX").map((l) => l.amount),
  )
  const creditTotal = sumNumbers(
    lines.filter((l) => l.lineType === "CREDIT").map((l) => Math.abs(l.amount)),
  )
  const totalAmount = subtotalAmount + taxAmount - creditTotal

  return { subtotalAmount, taxAmount, discountAmount: creditTotal, totalAmount }
}

const ticketStatusTimestamps = (status: SupportTicketStatus, createdAt: Date) => {
  if (status === "RESOLVED") {
    return { resolvedAt: addDays(createdAt, 2), closedAt: null }
  }
  if (status === "CLOSED") {
    return { resolvedAt: addDays(createdAt, 2), closedAt: addDays(createdAt, 3) }
  }
  return { resolvedAt: null, closedAt: null }
}

// ── Seed Data Factories ────────────────────────────────────────────────────

const invoiceSeedData = (): InvoiceSeed[] => {
  const periods = [
    {
      periodStart: new Date("2026-01-01T00:00:00.000Z"),
      periodEnd: new Date("2026-01-31T23:59:59.000Z"),
    },
    {
      periodStart: new Date("2026-02-01T00:00:00.000Z"),
      periodEnd: new Date("2026-02-28T23:59:59.000Z"),
    },
    {
      periodStart: new Date("2026-03-01T00:00:00.000Z"),
      periodEnd: new Date("2026-03-31T23:59:59.000Z"),
    },
    {
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-04-30T23:59:59.000Z"),
    },
    {
      periodStart: new Date("2026-05-01T00:00:00.000Z"),
      periodEnd: new Date("2026-05-31T23:59:59.000Z"),
    },
  ] as const

  return [
    {
      key: "01",
      status: "DRAFT",
      periodStart: periods[0].periodStart,
      periodEnd: periods[0].periodEnd,
      issuedAt: null,
      dueAt: null,
      paidAt: null,
      lines: [
        {
          lineType: "SUBSCRIPTION",
          description: "Starter plan subscription",
          quantity: 1,
          unitPrice: 89,
        },
        {
          lineType: "METERED",
          description: "API usage (120 units)",
          quantity: 120,
          unitPrice: 0.2,
        },
        {
          lineType: "TAX",
          description: "Tax",
          quantity: 1,
          unitPrice: 11.3,
        },
      ],
    },
    {
      key: "02",
      status: "OPEN",
      periodStart: periods[1].periodStart,
      periodEnd: periods[1].periodEnd,
      issuedAt: new Date("2026-03-01T10:00:00.000Z"),
      dueAt: new Date("2026-03-15T10:00:00.000Z"),
      paidAt: null,
      lines: [
        {
          lineType: "SUBSCRIPTION",
          description: "Growth plan subscription",
          quantity: 1,
          unitPrice: 149,
        },
        {
          lineType: "METERED",
          description: "Build minutes usage (85 units)",
          quantity: 85,
          unitPrice: 0.6,
        },
        {
          lineType: "ADJUSTMENT",
          description: "Support escalation fee",
          quantity: 1,
          unitPrice: 20,
        },
        {
          lineType: "TAX",
          description: "Tax",
          quantity: 1,
          unitPrice: 22,
        },
      ],
    },
    {
      key: "03",
      status: "PAID",
      periodStart: periods[2].periodStart,
      periodEnd: periods[2].periodEnd,
      issuedAt: new Date("2026-04-01T09:00:00.000Z"),
      dueAt: new Date("2026-04-12T09:00:00.000Z"),
      paidAt: new Date("2026-04-08T08:15:00.000Z"),
      lines: [
        {
          lineType: "SUBSCRIPTION",
          description: "Growth plan subscription",
          quantity: 1,
          unitPrice: 149,
        },
        {
          lineType: "METERED",
          description: "Storage requests (240 units)",
          quantity: 240,
          unitPrice: 0.18,
        },
        {
          lineType: "TAX",
          description: "Tax",
          quantity: 1,
          unitPrice: 19.2,
        },
      ],
    },
    {
      key: "04",
      status: "VOID",
      periodStart: periods[3].periodStart,
      periodEnd: periods[3].periodEnd,
      issuedAt: new Date("2026-05-01T07:30:00.000Z"),
      dueAt: new Date("2026-05-14T07:30:00.000Z"),
      paidAt: null,
      lines: [
        {
          lineType: "SUBSCRIPTION",
          description: "Pro plan subscription",
          quantity: 1,
          unitPrice: 299,
        },
        {
          lineType: "ADJUSTMENT",
          description: "One-time setup fee",
          quantity: 1,
          unitPrice: 30,
        },
        {
          lineType: "CREDIT",
          description: "Manual billing correction",
          quantity: 1,
          unitPrice: -40,
        },
        {
          lineType: "TAX",
          description: "Tax",
          quantity: 1,
          unitPrice: 21.5,
        },
      ],
    },
    {
      key: "05",
      status: "UNCOLLECTIBLE",
      periodStart: periods[4].periodStart,
      periodEnd: periods[4].periodEnd,
      issuedAt: new Date("2026-06-01T11:00:00.000Z"),
      dueAt: new Date("2026-06-08T11:00:00.000Z"),
      paidAt: null,
      lines: [
        {
          lineType: "SUBSCRIPTION",
          description: "Starter plan subscription",
          quantity: 1,
          unitPrice: 89,
        },
        {
          lineType: "METERED",
          description: "Bandwidth usage (300 units)",
          quantity: 300,
          unitPrice: 0.12,
        },
        {
          lineType: "ADJUSTMENT",
          description: "Late payment penalty",
          quantity: 1,
          unitPrice: 18,
        },
        {
          lineType: "TAX",
          description: "Tax",
          quantity: 1,
          unitPrice: 14.3,
        },
      ],
    },
  ]
}

const supportTicketSeedData = (): SupportTicketSeed[] => {
  const base = new Date("2026-05-23T08:00:00.000Z")

  return [
    {
      key: "01",
      status: "OPEN",
      department: "BILLING",
      priority: "MEDIUM",
      service: "BILLING",
      subject: "Invoice line item mismatch for April billing cycle",
      description:
        "The billed metered usage appears higher than our exported usage logs.",
      createdAt: addDays(base, -9),
    },
    {
      key: "02",
      status: "IN_PROGRESS",
      department: "TECHNICAL",
      priority: "HIGH",
      service: "DEPLOY",
      subject: "Deployment rollbacks intermittently fail in production",
      description:
        "Rollback command hangs after build artifact verification on larger images.",
      createdAt: addDays(base, -7),
    },
    {
      key: "03",
      status: "RESOLVED",
      department: "ACCOUNT",
      priority: "LOW",
      service: "AUTH",
      subject: "Need ownership transfer for departing team member",
      description:
        "Current owner is offboarded and we need owner reassignment guidance.",
      createdAt: addDays(base, -6),
    },
    {
      key: "04",
      status: "CLOSED",
      department: "COMPLIANCE",
      priority: "MEDIUM",
      service: "DATA",
      subject: "Requesting SOC2 evidence package for vendor review",
      description:
        "Security team requested latest control report and data retention details.",
      createdAt: addDays(base, -12),
    },
    {
      key: "05",
      status: "OPEN",
      department: "TECHNICAL",
      priority: "HIGH",
      service: "INTEGRATIONS",
      subject: "GitHub integration webhook signature validation errors",
      description:
        "Incoming webhook deliveries are rejected with signature mismatch.",
      createdAt: addDays(base, -2),
    },
  ]
}

// ── Seeder Class ───────────────────────────────────────────────────────────

class InvoicesSupportTicketsSeeder extends BaseSeeder {
  static override readonly seederName = "InvoicesSupportTickets"
  static override readonly classification = "dummy" as const
  static override readonly runOrder = 10
  static override readonly description =
    "Demo invoices (5) and support tickets (5) for console UI"

  private organizationId!: string
  private requesterWorkosUserId!: string
  private scopeCode!: string

  private parseArgs(): void {
    const orgId =
      this.cliArgs.get("--organization-id")?.trim() ?? null
    const userId =
      this.cliArgs.get("--requester-workos-user-id")?.trim() ?? null

    if (!orgId) {
      throw new Error("Missing required argument: --organization-id=<id>")
    }
    if (!userId) {
      throw new Error(
        "Missing required argument: --requester-workos-user-id=<id>",
      )
    }

    this.organizationId = orgId
    this.requesterWorkosUserId = userId
    this.scopeCode = toScopedSeedCode(orgId)
  }

  async seed(): Promise<void> {
    this.parseArgs()

    this.log(
      `Seeding invoices & tickets for org=${this.organizationId} scope=${this.scopeCode}`,
    )

    // ── Billing Account ──────────────────────────────────────────────
    const existingBillingAccount =
      await this.prisma.billingAccount.findUnique({
        where: { organizationId: this.organizationId },
      })

    const billingAccount = await this.prisma.billingAccount.upsert({
      where: { organizationId: this.organizationId },
      create: {
        organizationId: this.organizationId,
        currency: "USD",
        timezone: "UTC",
        status: "ACTIVE",
        metadataJson: {
          seedTag: SEED_TAG,
          seedScope: this.scopeCode,
        },
      },
      update: {
        metadataJson: {
          seedTag: SEED_TAG,
          seedScope: this.scopeCode,
        },
      },
    })

    if (existingBillingAccount) {
      this.trackUpdated()
    } else {
      this.trackCreated()
    }

    // ── Invoices ─────────────────────────────────────────────────────
    for (const seed of invoiceSeedData()) {
      const invoiceNumber = `SEED-${this.scopeCode}-INV-${seed.key}`
      const existingInvoice = await this.prisma.billingInvoice.findUnique({
        where: { invoiceNumber },
        select: { id: true },
      })

      const linePayload = seed.lines.map((line) => {
        const amount = line.quantity * line.unitPrice
        return {
          lineType: line.lineType,
          description: line.description,
          quantity: decimal(line.quantity),
          unitPrice: decimal(line.unitPrice),
          amount: decimal(amount),
          currency: "USD",
          metadataJson: {
            seedTag: SEED_TAG,
            seedScope: this.scopeCode,
            seedInvoice: invoiceNumber,
          },
        }
      })

      const totals = buildInvoiceTotals(
        seed.lines.map((line) => ({
          lineType: line.lineType,
          amount: line.quantity * line.unitPrice,
        })),
      )

      const invoiceData = {
        billingAccountId: billingAccount.id,
        subscriptionId: null,
        billingRunId: null,
        invoiceNumber,
        periodStart: seed.periodStart,
        periodEnd: seed.periodEnd,
        currency: "USD",
        status: seed.status,
        subtotalAmount: decimal(totals.subtotalAmount),
        taxAmount: decimal(totals.taxAmount),
        discountAmount: decimal(totals.discountAmount),
        totalAmount: decimal(totals.totalAmount),
        issuedAt: seed.issuedAt,
        dueAt: seed.dueAt,
        paidAt: seed.paidAt,
        metadataJson: {
          seedTag: SEED_TAG,
          seedScope: this.scopeCode,
          seedInvoice: invoiceNumber,
        },
      } satisfies Omit<Prisma.InvoiceUncheckedCreateInput, "id">

      if (existingInvoice) {
        await this.prisma.billingInvoice.update({
          where: { id: existingInvoice.id },
          data: {
            ...invoiceData,
            lines: { deleteMany: {}, create: linePayload },
          },
        })
        this.trackUpdated()
      } else {
        await this.prisma.billingInvoice.create({
          data: {
            ...invoiceData,
            lines: { create: linePayload },
          },
        })
        this.trackCreated()
      }
    }

    // ── Support Tickets ──────────────────────────────────────────────
    for (const seed of supportTicketSeedData()) {
      const ticketNumber = `SEED-${this.scopeCode}-TCK-${seed.key}`
      const existingTicket = await this.prisma.supportTicket.findUnique({
        where: { ticketNumber },
        select: { id: true },
      })

      const timestamps = ticketStatusTimestamps(seed.status, seed.createdAt)
      const ticketData = {
        ticketNumber,
        organizationId: this.organizationId,
        requesterWorkosUserId: this.requesterWorkosUserId,
        assignedAgentWorkosUserId: null,
        department: seed.department,
        priority: seed.priority,
        service: seed.service,
        status: seed.status,
        subject: seed.subject,
        description: seed.description,
        secureForm: null,
        attachmentsJson: [],
        resolvedAt: timestamps.resolvedAt,
        closedAt: timestamps.closedAt,
      } satisfies Omit<Prisma.SupportTicketUncheckedCreateInput, "id">

      if (existingTicket) {
        await this.prisma.supportTicket.update({
          where: { id: existingTicket.id },
          data: { ...ticketData },
        })
        this.trackUpdated()
      } else {
        await this.prisma.supportTicket.create({
          data: { ...ticketData, createdAt: seed.createdAt },
        })
        this.trackCreated()
      }
    }

    this.log("Done")
  }

  async unseed(): Promise<void> {
    this.parseArgs()

    this.log(
      `Removing seeded invoices & tickets for org=${this.organizationId} scope=${this.scopeCode}`,
    )

    // Delete invoices (lines cascade via FK)
    const deletedInvoices = await this.prisma.billingInvoice.deleteMany({
      where: {
        metadataJson: { path: ["seedTag"], equals: SEED_TAG },
        billingAccount: { organizationId: this.organizationId },
      },
    })
    this.trackDeleted(deletedInvoices.count)

    // Delete support tickets
    const deletedTickets = await this.prisma.supportTicket.deleteMany({
      where: {
        organizationId: this.organizationId,
        ticketNumber: { startsWith: `SEED-${this.scopeCode}-TCK-` },
      },
    })
    this.trackDeleted(deletedTickets.count)

    // Delete billing account (only if it has no remaining invoices)
    const remainingInvoices = await this.prisma.billingInvoice.count({
      where: { billingAccount: { organizationId: this.organizationId } },
    })
    if (remainingInvoices === 0) {
      const deletedAccounts = await this.prisma.billingAccount.deleteMany({
        where: {
          organizationId: this.organizationId,
          metadataJson: { path: ["seedTag"], equals: SEED_TAG },
        },
      })
      this.trackDeleted(deletedAccounts.count)
    } else {
      this.warn(
        `Skipped billing account deletion — ${remainingInvoices} non-seed invoices remain`,
      )
    }

    this.log("Done")
  }
}

registerSeeder(InvoicesSupportTicketsSeeder)
