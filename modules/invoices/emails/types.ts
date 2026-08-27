export interface InvoiceEmailLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: string
  amount: string
}

export interface InvoiceEmailCommonProps {
  invoiceNumber: string
  amount: string
  currency: string
  status: string
  issuedAt: string
  dueAt: string
  periodStart?: string
  periodEnd?: string
  paidAt?: string
  paymentMethod?: string
  subtotalAmount?: string
  taxAmount?: string
  discountAmount?: string
  lineItems?: InvoiceEmailLineItem[]
  recipientEmail?: string
  organizationName?: string
}

export type InvoiceCreatedEmailProps = InvoiceEmailCommonProps

export type PaymentReminderEmailProps = InvoiceEmailCommonProps

export type InvoicePaidEmailProps = InvoiceEmailCommonProps

export type InvoiceOverdueEmailProps = InvoiceEmailCommonProps

export interface InvoiceCancelledEmailProps extends InvoiceEmailCommonProps {
  reason?: string
}
