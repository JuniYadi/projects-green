import { prisma } from "@/lib/prisma"
import type {
  InvoiceListQuery,
  InvoiceListSortBy,
  InvoiceSortDirection,
  InvoiceStatus,
} from "@/modules/invoices/invoices.types"

type PrismaInvoiceStatus =
  | "DRAFT"
  | "OPEN"
  | "PAID"
  | "VOID"
  | "UNCOLLECTIBLE"

type InvoiceLineRecord = {
  id: string
  invoiceId: string
  lineType: "SUBSCRIPTION" | "METERED" | "ADJUSTMENT" | "TAX" | "CREDIT"
  description: string
  quantity: unknown
  unitPrice: unknown
  amount: unknown
  currency: string
  periodStart: Date | null
  periodEnd: Date | null
  metadataJson: unknown
  createdAt: Date
  updatedAt: Date
}

type InvoiceRecord = {
  id: string
  billingAccountId: string
  subscriptionId: string | null
  billingRunId: string | null
  invoiceNumber: string
  periodStart: Date
  periodEnd: Date
  currency: string
  status: PrismaInvoiceStatus
  subtotalAmount: unknown
  taxAmount: unknown
  discountAmount: unknown
  totalAmount: unknown
  issuedAt: Date | null
  dueAt: Date | null
  paidAt: Date | null
  type: string | null
  paymentMethod: string | null
  metadataJson: unknown
  metadata: unknown
  createdAt: Date
  updatedAt: Date
}

export type InvoiceDetailRecord = InvoiceRecord & {
  lines: InvoiceLineRecord[]
}

type InvoiceDelegate = {
  findMany: (args: unknown) => Promise<InvoiceRecord[]>
  findFirst: (args: unknown) => Promise<InvoiceDetailRecord | null>
  updateMany: (args: unknown) => Promise<{ count: number }>
}

const APP_TO_PRISMA_STATUS: Record<InvoiceStatus, PrismaInvoiceStatus> = {
  draft: "DRAFT",
  open: "OPEN",
  paid: "PAID",
  canceled: "VOID",
  uncollectible: "UNCOLLECTIBLE",
}

const toPrismaSortField = (value: InvoiceListSortBy) => {
  if (value === "issuedAt") {
    return "issuedAt"
  }

  if (value === "dueAt") {
    return "dueAt"
  }

  if (value === "totalAmount") {
    return "totalAmount"
  }

  if (value === "status") {
    return "status"
  }

  return "invoiceNumber"
}

const toPrismaSortDirection = (value: InvoiceSortDirection) => {
  return value === "asc" ? "asc" : "desc"
}

const buildInvoiceListWhere = (input: {
  organizationId?: string | null
  query: InvoiceListQuery
}) => {
  const where: Record<string, unknown> = {}

  if (input.organizationId) {
    where.billingAccount = {
      organizationId: input.organizationId,
    }
  }

  const search = input.query.search?.trim()
  if (search) {
    where.invoiceNumber = {
      contains: search,
      mode: "insensitive",
    }
  }

  if (input.query.status) {
    where.status = APP_TO_PRISMA_STATUS[input.query.status]
  }

  return where
}

export type InvoiceRepository = {
  listByOrganization: (input: {
    organizationId?: string | null
    query: InvoiceListQuery
  }) => Promise<InvoiceRecord[]>
  findByIdForOrganization: (input: {
    organizationId?: string | null
    invoiceId: string
  }) => Promise<InvoiceDetailRecord | null>
  updateStatusByIdForOrganization: (input: {
    organizationId?: string | null
    invoiceId: string
    status: PrismaInvoiceStatus
  }) => Promise<void>
}

const getInvoiceDelegate = (): InvoiceDelegate => {
  const delegate = (prisma as unknown as { invoice?: InvoiceDelegate }).invoice

  if (!delegate) {
    throw new Error("Invoice delegate is not available on Prisma client.")
  }

  return delegate
}

export const createPrismaInvoiceRepository = (): InvoiceRepository => {
  return {
    async listByOrganization({ organizationId, query }) {
      const sortBy = toPrismaSortField(query.sortBy ?? "issuedAt")
      const sortDir = toPrismaSortDirection(query.sortDir ?? "desc")

      return getInvoiceDelegate().findMany({
        where: buildInvoiceListWhere({ organizationId, query }),
        orderBy: [{ [sortBy]: sortDir }, { createdAt: "desc" }],
        take: 200,
      })
    },
    async findByIdForOrganization({ organizationId, invoiceId }) {
      return getInvoiceDelegate().findFirst({
        where: {
          OR: [
            { id: invoiceId },
            { invoiceNumber: invoiceId },
          ],
          billingAccount: organizationId
            ? {
                organizationId,
              }
            : undefined,
        },
        include: {
          lines: {
            orderBy: [
              {
                periodStart: "asc",
              },
              {
                createdAt: "asc",
              },
            ],
          },
        },
      })
    },
    async updateStatusByIdForOrganization({ organizationId, invoiceId, status }) {
      await getInvoiceDelegate().updateMany({
        where: {
          OR: [
            { id: invoiceId },
            { invoiceNumber: invoiceId },
          ],
          billingAccount: organizationId
            ? {
                organizationId,
              }
            : undefined,
        },
        data: {
          status,
        },
      })
    },
  }
}
