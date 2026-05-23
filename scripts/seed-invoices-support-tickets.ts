import { createHash } from "node:crypto"

import { PrismaPg } from "@prisma/adapter-pg"
import {
  InvoiceLineType,
  InvoiceStatus,
  Prisma,
  SupportTicketDepartment,
  SupportTicketPriority,
  SupportTicketService,
  SupportTicketStatus,
} from "@prisma/client"
import { PrismaClient } from "@prisma/client/index"

const DATABASE_URL = process.env.DATABASE_URL?.trim()
if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL environment variable")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: DATABASE_URL,
  }),
})

const SEED_TAG = "console-demo-v1"

type SeederArgs = {
  organizationId: string
  requesterWorkosUserId: string
}

type InvoiceLineSeed = {
  lineType: InvoiceLineType
  description: string
  quantity: number
  unitPrice: number
}

type InvoiceSeed = {
  key: string
  status: InvoiceStatus
  periodStart: Date
  periodEnd: Date
  issuedAt: Date | null
  dueAt: Date | null
  paidAt: Date | null
  lines: InvoiceLineSeed[]
}

type SupportTicketSeed = {
  key: string
  status: SupportTicketStatus
  department: SupportTicketDepartment
  priority: SupportTicketPriority
  service: SupportTicketService | null
  subject: string
  description: string
  createdAt: Date
}

const args = process.argv.slice(2)

const getArgValue = (name: string) => {
  const match = args.find((item) => item.startsWith(`${name}=`))
  if (!match) {
    return null
  }

  const [, value] = match.split("=")
  const normalizedValue = value?.trim()

  return normalizedValue ? normalizedValue : null
}

const parseArgs = (): SeederArgs => {
  const organizationId = getArgValue("--organization-id")
  const requesterWorkosUserId = getArgValue("--requester-workos-user-id")

  if (!organizationId) {
    throw new Error("Missing required argument: --organization-id=<id>")
  }

  if (!requesterWorkosUserId) {
    throw new Error(
      "Missing required argument: --requester-workos-user-id=<id>"
    )
  }

  return {
    organizationId,
    requesterWorkosUserId,
  }
}

const decimal = (value: number) => {
  return new Prisma.Decimal(value.toFixed(6))
}

const sumNumbers = (values: number[]) => {
  return values.reduce((total, current) => total + current, 0)
}

const toScopedSeedCode = (organizationId: string) => {
  return createHash("sha1")
    .update(organizationId.trim())
    .digest("hex")
    .slice(0, 8)
    .toUpperCase()
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

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

const ticketStatusTimestamps = (
  status: SupportTicketStatus,
  createdAt: Date
) => {
  if (status === "RESOLVED") {
    return {
      resolvedAt: addDays(createdAt, 2),
      closedAt: null,
    }
  }

  if (status === "CLOSED") {
    return {
      resolvedAt: addDays(createdAt, 2),
      closedAt: addDays(createdAt, 3),
    }
  }

  return {
    resolvedAt: null,
    closedAt: null,
  }
}

const buildInvoiceTotals = (lines: Array<{ lineType: InvoiceLineType; amount: number }>) => {
  const subtotalAmount = sumNumbers(
    lines
      .filter((line) => line.lineType !== "TAX" && line.lineType !== "CREDIT")
      .map((line) => line.amount)
  )
  const taxAmount = sumNumbers(
    lines.filter((line) => line.lineType === "TAX").map((line) => line.amount)
  )
  const creditTotal = sumNumbers(
    lines
      .filter((line) => line.lineType === "CREDIT")
      .map((line) => Math.abs(line.amount))
  )
  const totalAmount = subtotalAmount + taxAmount - creditTotal

  return {
    subtotalAmount,
    taxAmount,
    discountAmount: creditTotal,
    totalAmount,
  }
}

const main = async () => {
  const input = parseArgs()
  const scopeCode = toScopedSeedCode(input.organizationId)

  const summary = {
    mode: "upsert",
    organizationId: input.organizationId,
    requesterWorkosUserId: input.requesterWorkosUserId,
    seedTag: SEED_TAG,
    billingAccount: {
      created: 0,
      updated: 0,
      id: "",
    },
    invoices: {
      created: 0,
      updated: 0,
      totalLineItems: 0,
    },
    supportTickets: {
      created: 0,
      updated: 0,
    },
  }

  const existingBillingAccount = await prisma.billingAccount.findUnique({
    where: {
      organizationId: input.organizationId,
    },
  })

  const billingAccount = await prisma.billingAccount.upsert({
    where: {
      organizationId: input.organizationId,
    },
    create: {
      organizationId: input.organizationId,
      currency: "USD",
      timezone: "UTC",
      status: "ACTIVE",
      metadataJson: {
        seedTag: SEED_TAG,
        seedScope: scopeCode,
      },
    },
    update: {
      metadataJson: {
        seedTag: SEED_TAG,
        seedScope: scopeCode,
      },
    },
  })

  summary.billingAccount.id = billingAccount.id
  if (existingBillingAccount) {
    summary.billingAccount.updated += 1
  } else {
    summary.billingAccount.created += 1
  }

  const invoiceSeeds = invoiceSeedData()
  for (const seed of invoiceSeeds) {
    const invoiceNumber = `SEED-${scopeCode}-INV-${seed.key}`
    const existingInvoice = await prisma.invoice.findUnique({
      where: {
        invoiceNumber,
      },
      select: {
        id: true,
      },
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
          seedScope: scopeCode,
          seedInvoice: invoiceNumber,
        },
      }
    })

    const totals = buildInvoiceTotals(
      seed.lines.map((line) => ({
        lineType: line.lineType,
        amount: line.quantity * line.unitPrice,
      }))
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
        seedScope: scopeCode,
        seedInvoice: invoiceNumber,
      },
    } satisfies Omit<Prisma.InvoiceUncheckedCreateInput, "id">

    if (existingInvoice) {
      await prisma.invoice.update({
        where: {
          id: existingInvoice.id,
        },
        data: {
          ...invoiceData,
          lines: {
            deleteMany: {},
            create: linePayload,
          },
        },
      })
      summary.invoices.updated += 1
    } else {
      await prisma.invoice.create({
        data: {
          ...invoiceData,
          lines: {
            create: linePayload,
          },
        },
      })
      summary.invoices.created += 1
    }

    summary.invoices.totalLineItems += linePayload.length
  }

  const ticketSeeds = supportTicketSeedData()
  for (const seed of ticketSeeds) {
    const ticketNumber = `SEED-${scopeCode}-TCK-${seed.key}`
    const existingTicket = await prisma.supportTicket.findUnique({
      where: {
        ticketNumber,
      },
      select: {
        id: true,
      },
    })

    const timestamps = ticketStatusTimestamps(seed.status, seed.createdAt)
    const ticketData = {
      ticketNumber,
      organizationId: input.organizationId,
      requesterWorkosUserId: input.requesterWorkosUserId,
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
      await prisma.supportTicket.update({
        where: {
          id: existingTicket.id,
        },
        data: {
          ...ticketData,
        },
      })
      summary.supportTickets.updated += 1
    } else {
      await prisma.supportTicket.create({
        data: {
          ...ticketData,
          createdAt: seed.createdAt,
        },
      })
      summary.supportTickets.created += 1
    }
  }

  console.log("Invoice and support-ticket seeding completed.")
  console.log(JSON.stringify(summary, null, 2))
}

try {
  await main()
} catch (error) {
  console.error("Failed to seed invoices and support tickets.")
  if (error instanceof Error) {
    console.error(error.message)
  }
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
