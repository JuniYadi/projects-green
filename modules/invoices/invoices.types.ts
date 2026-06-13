export type InvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "canceled"
  | "uncollectible"

export type InvoiceListSortBy =
  | "invoiceNumber"
  | "issuedAt"
  | "dueAt"
  | "totalAmount"
  | "status"

export type InvoiceSortDirection = "asc" | "desc"

export type InvoiceListQuery = {
  search?: string
  sortBy?: InvoiceListSortBy
  sortDir?: InvoiceSortDirection
  status?: InvoiceStatus
}

export type InvoiceListItem = {
  id: string
  invoiceNumber: string
  issuedAt: string | null
  dueAt: string | null
  totalAmount: number
  currency: string
  status: InvoiceStatus
}

export type InvoiceLineItem = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  currency: string
}

export type InvoiceDetail = InvoiceListItem & {
  subtotalAmount: number
  taxAmount: number
  discountAmount: number
  periodStart: string
  periodEnd: string
  paidAt: string | null
  type: string | null
  paymentMethod: string | null
  lineItems: InvoiceLineItem[]
  billingAccountId?: string
}

export type InvoicePaymentMethod = {
  id: string
  label: string
  type: "card" | "bank_transfer"
  last4: string | null
}

export type InvoiceListSuccessResponse = {
  ok: true
  invoices: InvoiceListItem[]
}

export type InvoiceDetailSuccessResponse = {
  ok: true
  invoice: InvoiceDetail
  canMarkCanceled: boolean
  organization?: {
    name: string
    billingFullName?: string | null
    billingAddress?: string | null
    billingCity?: string | null
    billingState?: string | null
    billingCountry?: string | null
    billingPostCode?: string | null
  } | null
}

export type InvoiceCancelSuccessResponse = {
  ok: true
  invoice: InvoiceDetail
}

export type InvoiceErrorResponse = {
  ok: false
  error:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "INVALID_QUERY"
    | "INVOICE_CANCEL_NOT_ALLOWED"
    | "INTERNAL_SERVER_ERROR"
  message: string
}
