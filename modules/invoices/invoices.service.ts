import type {
  InvoiceDetailRecord,
  InvoiceRepository,
} from "@/modules/invoices/invoices.repository"
import { prisma } from "@/lib/prisma"
import { toPaymentInfoDTO } from "@/modules/invoices/invoices.dto"
import type {
  InvoiceDetail,
  InvoiceLineItem,
  InvoiceListItem,
  InvoiceListQuery,
  InvoicePaymentMethod,
  InvoiceStatus,
  PaymentInfoDTO,
} from "@/modules/invoices/invoices.types"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { Prisma } from "@prisma/client"

export class InvoiceNotFoundError extends Error {
  constructor(invoiceId: string) {
    super(`Invoice ${invoiceId} was not found.`)
    this.name = "InvoiceNotFoundError"
  }
}

export class InvoiceCancelNotAllowedError extends Error {
  constructor(invoiceId: string, status: InvoiceStatus) {
    super(`Invoice ${invoiceId} cannot be canceled from status ${status}.`)
    this.name = "InvoiceCancelNotAllowedError"
  }
}

export type InvoiceService = {
  listInvoices: (input: {
    organizationId?: string | null
    query: InvoiceListQuery
  }) => Promise<InvoiceListItem[]>
  getInvoiceDetail: (input: {
    organizationId?: string | null
    invoiceId: string
  }) => Promise<InvoiceDetail>
  getPaymentInfo: (input: {
    organizationId?: string | null
    invoiceId: string
  }) => Promise<PaymentInfoDTO | null>
  cancelInvoice: (input: {
    organizationId?: string | null
    invoiceId: string
  }) => Promise<InvoiceDetail>
  markInvoiceAsPaid: (input: {
    organizationId?: string | null
    invoiceId: string
    adminUserId: string
    paymentMethod?: string
    referenceNumber?: string
    notes?: string
  }) => Promise<InvoiceDetail>
  getPaymentMethodOptions: () => InvoicePaymentMethod[]
}

const PRISMA_TO_APP_INVOICE_STATUS: Record<PrismaInvoiceStatus, InvoiceStatus> = {
  DRAFT: "draft",
  OPEN: "open",
  PAID: "paid",
  VOID: "canceled",
  UNCOLLECTIBLE: "uncollectible",
}

type PrismaInvoiceLineType =
  | "SUBSCRIPTION"
  | "METERED"
  | "ADJUSTMENT"
  | "TAX"
  | "CREDIT"

const FALLBACK_LINE_DESCRIPTION_BY_TYPE: Record<PrismaInvoiceLineType, string> = {
  SUBSCRIPTION: "Subscription charge",
  METERED: "Metered usage",
  ADJUSTMENT: "Adjustment",
  TAX: "Tax",
  CREDIT: "Credit",
}

const DEFAULT_PAYMENT_METHOD_OPTIONS: InvoicePaymentMethod[] = [
  {
    id: "pm_card_4242",
    label: "Visa ending in 4242",
    type: "card",
    last4: "4242",
  },
  {
    id: "pm_bank_9124",
    label: "Bank transfer ending in 9124",
    type: "bank_transfer",
    last4: "9124",
  },
]

const toNumber = (value: unknown) => {
  return Number(value ?? 0)
}

export const toInvoiceStatus = (value: PrismaInvoiceStatus): InvoiceStatus => {
  return PRISMA_TO_APP_INVOICE_STATUS[value]
}

const toInvoiceListItem = (invoice: {
  id: string
  invoiceNumber: string
  issuedAt: Date | null
  dueAt: Date | null
  dueDate?: Date | null
  totalAmount: unknown
  currency: string
  status: PrismaInvoiceStatus
  createdAt: Date
}): InvoiceListItem => {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt?.toISOString() ?? invoice.createdAt.toISOString(),
    dueAt: invoice.dueAt?.toISOString() ?? invoice.dueDate?.toISOString() ?? null,
    totalAmount: toNumber(invoice.totalAmount),
    currency: invoice.currency,
    status: toInvoiceStatus(invoice.status),
  }
}

const toInvoiceLineItem = (line: {
  id: string
  description: string
  lineType: PrismaInvoiceLineType
  quantity: unknown
  unitPrice: unknown
  amount: unknown
  currency: string
}): InvoiceLineItem => {
  return {
    id: line.id,
    description:
      line.description.trim() || FALLBACK_LINE_DESCRIPTION_BY_TYPE[line.lineType],
    quantity: toNumber(line.quantity),
    unitPrice: toNumber(line.unitPrice),
    amount: toNumber(line.amount),
    currency: line.currency,
  }
}

export const toInvoiceDetail = (invoice: InvoiceDetailRecord): InvoiceDetail => {
  return {
    ...toInvoiceListItem(invoice),
    subtotalAmount: toNumber(invoice.subtotalAmount),
    taxAmount: toNumber(invoice.taxAmount),
    discountAmount: toNumber(invoice.discountAmount),
    periodStart: invoice.periodStart.toISOString(),
    periodEnd: invoice.periodEnd.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
    type: invoice.type ?? null,
    paymentMethod: invoice.paymentMethod ?? null,
    lineItems: invoice.lines.map((line) => toInvoiceLineItem(line)),
    billingAccountId: invoice.billingAccountId,
  }
}

type CreateInvoiceServiceOptions = {
  repository?: InvoiceRepository
}

const createLazyDefaultRepository = (): InvoiceRepository => {
  const loadRepository = async () => {
    const repositoryModule = await import("@/modules/invoices/invoices.repository")
    return repositoryModule.createPrismaInvoiceRepository()
  }

  return {
    async listByOrganization(input) {
      const repository = await loadRepository()
      return repository.listByOrganization(input)
    },
    async findByIdForOrganization(input) {
      const repository = await loadRepository()
      return repository.findByIdForOrganization(input)
    },
    async updateStatusByIdForOrganization(input) {
      const repository = await loadRepository()
      return repository.updateStatusByIdForOrganization(input)
    },
  }
}

export const createInvoiceService = (
  options: CreateInvoiceServiceOptions = {}
): InvoiceService => {
  const repository = options.repository ?? createLazyDefaultRepository()

  return {
    async listInvoices({ organizationId, query }) {
      const invoices = await repository.listByOrganization({
        organizationId,
        query,
      })

      return invoices.map((invoice) => toInvoiceListItem(invoice))
    },
    async getInvoiceDetail({ organizationId, invoiceId }) {
      const invoice = await repository.findByIdForOrganization({
        organizationId,
        invoiceId,
      })

      if (!invoice) {
        throw new InvoiceNotFoundError(invoiceId)
      }

      return toInvoiceDetail(invoice)
    },
    async getPaymentInfo({ organizationId, invoiceId }) {
      const invoice = await repository.findByIdForOrganization({
        organizationId,
        invoiceId,
      })

      if (!invoice) {
        throw new InvoiceNotFoundError(invoiceId)
      }

      return toPaymentInfoDTO(invoice)
    },
    async markInvoiceAsPaid({
      organizationId,
      invoiceId,
      adminUserId,
      paymentMethod,
      referenceNumber,
      notes,
    }) {
      const invoice = await repository.findByIdForOrganization({
        organizationId,
        invoiceId,
      })

      if (!invoice) {
        throw new InvoiceNotFoundError(invoiceId)
      }

      const currentStatus = toInvoiceStatus(invoice.status)
      if (currentStatus !== "open") {
        throw new Error(
          `Invoice ${invoiceId} cannot be marked as paid from status ${currentStatus}.`
        )
      }

      const idempotencyKey = `manual:mark-paid:${invoiceId}`

      await prisma.$transaction(async (tx) => {
        const prismaClient = tx as unknown as import("@prisma/client").PrismaClient

        // Idempotency check
        const existingLog = await tx.paymentAuditLog.findFirst({
          where: {
            action: "MANUAL_MARK_PAID",
            entityType: "Invoice",
            entityId: invoiceId,
          },
        })

        if (existingLog) {
          throw new Error("INVOICE_ALREADY_MARKED_PAID")
        }

        // Look up billing account for organizationId
        const billingAccount = await tx.billingAccount.findUnique({
          where: { id: invoice.billingAccountId },
        })

        if (!billingAccount?.organizationId) {
          throw new Error("BILLING_ACCOUNT_NOT_FOUND")
        }

        // Credit balance
        const billingTx = new BillingTransactionService(prismaClient)
        const totalAmount = toNumber(invoice.totalAmount)
        const result = await billingTx.creditBalance({
          organizationId: billingAccount.organizationId,
          amount: new Prisma.Decimal(totalAmount),
          currency: invoice.currency,
          source: "TOPUP",
          reason: `Manual mark paid: ${invoice.invoiceNumber}`,
          idempotencyKey,
          invoiceId: invoice.id,
          metadata: {
            markedBy: adminUserId,
            paymentMethod: paymentMethod ?? null,
            referenceNumber: referenceNumber ?? null,
            notes: notes ?? null,
          },
        })

        if (result.alreadyProcessed) {
          throw new Error("INVOICE_ALREADY_MARKED_PAID")
        }

        // Update invoice status to PAID
        await tx.billingInvoice.update({
          where: { id: invoiceId },
          data: {
            status: "PAID",
            paidAt: new Date(),
          },
        })

        // Create audit log
        await tx.paymentAuditLog.create({
          data: {
            action: "MANUAL_MARK_PAID",
            entityType: "Invoice",
            entityId: invoiceId,
            actorId: adminUserId,
            details: {
              paymentMethod,
              referenceNumber,
              notes,
              amount: totalAmount,
              currency: invoice.currency,
            },
          },
        })
      })

      // Re-fetch and return updated invoice
      const updatedInvoice = await repository.findByIdForOrganization({
        organizationId,
        invoiceId,
      })

      if (!updatedInvoice) {
        throw new InvoiceNotFoundError(invoiceId)
      }

      return toInvoiceDetail(updatedInvoice)
    },
    async cancelInvoice({ organizationId, invoiceId }) {
      const invoice = await repository.findByIdForOrganization({
        organizationId,
        invoiceId,
      })

      if (!invoice) {
        throw new InvoiceNotFoundError(invoiceId)
      }

      const currentStatus = toInvoiceStatus(invoice.status)
      if (currentStatus === "paid" || currentStatus === "canceled") {
        throw new InvoiceCancelNotAllowedError(invoiceId, currentStatus)
      }

      await repository.updateStatusByIdForOrganization({
        organizationId,
        invoiceId,
        status: "VOID",
      })

      const canceledInvoice = await repository.findByIdForOrganization({
        organizationId,
        invoiceId,
      })

      if (!canceledInvoice) {
        throw new InvoiceNotFoundError(invoiceId)
      }

      return toInvoiceDetail(canceledInvoice)
    },
    getPaymentMethodOptions() {
      return DEFAULT_PAYMENT_METHOD_OPTIONS
    },
  }
}
type PrismaInvoiceStatus =
  | "DRAFT"
  | "OPEN"
  | "PAID"
  | "VOID"
  | "UNCOLLECTIBLE"
