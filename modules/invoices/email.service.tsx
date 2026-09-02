import { render } from "react-email"

import { createEmailLog } from "@/lib/email-log"
import { sendEmail } from "@/lib/queue/email"

import { InvoiceCreatedEmail } from "./emails/invoice-created"
import { PaymentReminderEmail } from "./emails/payment-reminder"
import { InvoicePaidEmail } from "./emails/invoice-paid"
import { InvoiceOverdueEmail } from "./emails/invoice-overdue"
import { InvoiceCancelledEmail } from "./emails/invoice-cancelled"
import { PaymentConfirmationSubmittedEmail } from "./emails/payment-confirmation-submitted"

import type {
  InvoiceEmailLineItem,
  InvoiceEmailCommonProps,
} from "./emails/types"
import type {
  InvoiceDetail,
  InvoiceListItem,
  InvoiceStatus,
} from "./invoices.types"

export class InvoiceEmailServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvoiceEmailServiceError"
  }
}

export type InvoiceEmailServiceOptions = {
  organizationName?: string
}

export type InvoiceEmailService = {
  sendInvoiceCreated(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string,
    organizationId?: string,
    options?: InvoiceEmailServiceOptions
  ): Promise<void>
  sendPaymentReminder(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string,
    organizationId?: string,
    options?: InvoiceEmailServiceOptions
  ): Promise<void>
  sendInvoicePaid(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string,
    organizationId?: string,
    options?: InvoiceEmailServiceOptions
  ): Promise<void>
  sendInvoiceOverdue(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string,
    organizationId?: string,
    options?: InvoiceEmailServiceOptions
  ): Promise<void>
  sendInvoiceCancelled(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string,
    reason?: string,
    organizationId?: string,
    options?: InvoiceEmailServiceOptions
  ): Promise<void>
  sendPaymentConfirmationSubmitted(
    data: {
      invoiceId: string
      invoiceNumber: string
      amount: number
      currency: string
      bankName: string
      senderName?: string
      confirmationId: string
    },
    recipientEmail: string
  ): Promise<void>
}

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  open: "Open",
  paid: "Paid",
  canceled: "Canceled",
  uncollectible: "Uncollectible",
}

const formatCurrency = (amount: number, currency: string): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount)
}

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "N/A"
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export const getInvoiceEmailData = (
  invoice: InvoiceListItem | InvoiceDetail,
  recipientEmail?: string,
  organizationName?: string
): InvoiceEmailCommonProps => {
  const amount = "totalAmount" in invoice ? invoice.totalAmount : 0
  const currency = invoice.currency
  const periodStart = "periodStart" in invoice ? invoice.periodStart : null
  const periodEnd = "periodEnd" in invoice ? invoice.periodEnd : null
  const isDetail = "lineItems" in invoice

  let lineItems: InvoiceEmailLineItem[] | undefined
  let subtotalAmount: string | undefined
  let taxAmount: string | undefined
  let discountAmount: string | undefined
  let paidAt: string | undefined
  let paymentMethod: string | undefined

  if (isDetail) {
    const detail = invoice as InvoiceDetail
    if (detail.lineItems && detail.lineItems.length > 0) {
      lineItems = detail.lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: formatCurrency(item.unitPrice, item.currency || currency),
        amount: formatCurrency(item.amount, item.currency || currency),
      }))
    }

    if (detail.subtotalAmount !== undefined && detail.subtotalAmount !== null) {
      subtotalAmount = formatCurrency(detail.subtotalAmount, currency)
    }

    if (detail.taxAmount !== undefined && detail.taxAmount !== null) {
      taxAmount = formatCurrency(detail.taxAmount, currency)
    }

    if (detail.discountAmount !== undefined && detail.discountAmount !== null) {
      discountAmount = formatCurrency(detail.discountAmount, currency)
    }

    if (detail.paidAt) {
      paidAt = formatDate(detail.paidAt)
    }

    if (detail.paymentMethod) {
      paymentMethod = detail.paymentMethod
    }
  }

  return {
    invoiceNumber: invoice.invoiceNumber,
    amount: formatCurrency(amount, currency),
    currency,
    status: INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status,
    issuedAt: formatDate(invoice.issuedAt),
    dueAt: formatDate(invoice.dueAt),
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
    subtotalAmount,
    taxAmount,
    discountAmount,
    lineItems,
    paidAt,
    paymentMethod,
    recipientEmail,
    organizationName,
  }
}

export const createInvoiceEmailService = (): InvoiceEmailService => ({
  async sendInvoiceCreated(invoice, recipientEmail, organizationId, options) {
    try {
      const emailData = getInvoiceEmailData(
        invoice,
        recipientEmail,
        options?.organizationName
      )
      const html = await render(<InvoiceCreatedEmail {...emailData} />)
      const subject = `Invoice ${invoice.invoiceNumber} - Payment Due ${emailData.dueAt}`
      const emailLogId = await createEmailLog({
        recipientEmail,
        type: "INVOICE_CREATED",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "invoice",
        relatedEntityId: invoice.id,
      })

      await sendEmail({
        to: recipientEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send invoice created email:", error)
      throw new InvoiceEmailServiceError(
        `Failed to send invoice created notification: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  async sendPaymentReminder(invoice, recipientEmail, organizationId, options) {
    try {
      const emailData = getInvoiceEmailData(
        invoice,
        recipientEmail,
        options?.organizationName
      )
      const html = await render(<PaymentReminderEmail {...emailData} />)
      const subject = `Reminder: Invoice ${invoice.invoiceNumber} Due Soon`
      const emailLogId = await createEmailLog({
        recipientEmail,
        type: "INVOICE_PAYMENT_REMINDER",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "invoice",
        relatedEntityId: invoice.id,
      })

      await sendEmail({
        to: recipientEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send payment reminder email:", error)
      throw new InvoiceEmailServiceError(
        `Failed to send payment reminder notification: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  async sendInvoicePaid(invoice, recipientEmail, organizationId, options) {
    try {
      const emailData = getInvoiceEmailData(
        invoice,
        recipientEmail,
        options?.organizationName
      )
      const html = await render(<InvoicePaidEmail {...emailData} />)
      const subject = `Payment Received - Invoice ${invoice.invoiceNumber}`
      const emailLogId = await createEmailLog({
        recipientEmail,
        type: "INVOICE_PAID",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "invoice",
        relatedEntityId: invoice.id,
      })

      await sendEmail({
        to: recipientEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send invoice paid email:", error)
      throw new InvoiceEmailServiceError(
        `Failed to send invoice paid notification: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  async sendInvoiceOverdue(invoice, recipientEmail, organizationId, options) {
    try {
      const emailData = getInvoiceEmailData(
        invoice,
        recipientEmail,
        options?.organizationName
      )
      const html = await render(<InvoiceOverdueEmail {...emailData} />)
      const subject = `OVERDUE: Invoice ${invoice.invoiceNumber} Payment Required`
      const emailLogId = await createEmailLog({
        recipientEmail,
        type: "INVOICE_OVERDUE",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "invoice",
        relatedEntityId: invoice.id,
      })

      await sendEmail({
        to: recipientEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send invoice overdue email:", error)
      throw new InvoiceEmailServiceError(
        `Failed to send invoice overdue notification: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  async sendInvoiceCancelled(
    invoice,
    recipientEmail,
    reason,
    organizationId,
    options
  ) {
    try {
      const emailData = getInvoiceEmailData(
        invoice,
        recipientEmail,
        options?.organizationName
      )
      const html = await render(
        <InvoiceCancelledEmail {...emailData} reason={reason} />
      )
      const subject = `Invoice ${invoice.invoiceNumber} Has Been Cancelled`
      const emailLogId = await createEmailLog({
        recipientEmail,
        type: "INVOICE_CANCELLED",
        subject,
        bodyHtml: html,
        organizationId,
        relatedEntityType: "invoice",
        relatedEntityId: invoice.id,
      })

      await sendEmail({
        to: recipientEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send invoice cancelled email:", error)
      throw new InvoiceEmailServiceError(
        `Failed to send invoice cancelled notification: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },
  async sendPaymentConfirmationSubmitted(data, recipientEmail) {
    try {
      const amount = formatCurrency(data.amount, data.currency)
      const html = await render(
        <PaymentConfirmationSubmittedEmail
          invoiceNumber={data.invoiceNumber}
          amount={amount}
          bankName={data.bankName}
          senderName={data.senderName}
          confirmationId={data.confirmationId}
        />
      )
      const subject = `Payment Confirmation Submitted - Invoice ${data.invoiceNumber}`
      const emailLogId = await createEmailLog({
        recipientEmail,
        type: "PAYMENT_CONFIRMATION_SUBMITTED",
        subject,
        bodyHtml: html,
        relatedEntityType: "payment_confirmation",
        relatedEntityId: data.confirmationId,
      })

      await sendEmail({
        to: recipientEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send payment confirmation email:", error)
      const detail = error instanceof Error ? error.message : String(error)
      throw new InvoiceEmailServiceError(
        "Failed to send payment confirmation notification: " + detail
      )
    }
  },
})

export const invoiceEmailService = createInvoiceEmailService()
