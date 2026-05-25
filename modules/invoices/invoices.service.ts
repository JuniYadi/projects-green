import type {
  InvoiceDetailRecord,
  InvoiceRepository,
} from "@/modules/invoices/invoices.repository"
import type {
  InvoiceDetail,
  InvoiceLineItem,
  InvoiceListItem,
  InvoiceListQuery,
  InvoicePaymentMethod,
  InvoiceStatus,
} from "@/modules/invoices/invoices.types"

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
  cancelInvoice: (input: {
    organizationId?: string | null
    invoiceId: string
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
  totalAmount: unknown
  currency: string
  status: PrismaInvoiceStatus
}): InvoiceListItem => {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
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
