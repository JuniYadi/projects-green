import { render } from "@react-email/components"
import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

import { InvoiceCreatedEmail } from "./emails/invoice-created"
import { PaymentReminderEmail } from "./emails/payment-reminder"
import { InvoicePaidEmail } from "./emails/invoice-paid"
import { InvoiceOverdueEmail } from "./emails/invoice-overdue"
import { InvoiceCancelledEmail } from "./emails/invoice-cancelled"
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

export type InvoiceEmailService = {
  sendInvoiceCreated(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string
  ): Promise<void>
  sendPaymentReminder(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string
  ): Promise<void>
  sendInvoicePaid(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string
  ): Promise<void>
  sendInvoiceOverdue(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string
  ): Promise<void>
  sendInvoiceCancelled(
    invoice: InvoiceListItem | InvoiceDetail,
    recipientEmail: string,
    reason?: string
  ): Promise<void>
}

type InvoiceEmailServiceOptions = {
  transporter?: Transporter
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

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "N/A"
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export const getInvoiceEmailData = (
  invoice: InvoiceListItem | InvoiceDetail
) => {
  const amount = "totalAmount" in invoice ? invoice.totalAmount : 0
  const currency = invoice.currency
  const periodStart = "periodStart" in invoice ? invoice.periodStart : null
  const periodEnd = "periodEnd" in invoice ? invoice.periodEnd : null

  return {
    invoiceNumber: invoice.invoiceNumber,
    amount: formatCurrency(amount, currency),
    currency,
    status: INVOICE_STATUS_LABELS[invoice.status],
    issuedAt: formatDate(invoice.issuedAt),
    dueAt: formatDate(invoice.dueAt),
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
  }
}

const createLazyDefaultTransporter = (): Transporter => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export const createInvoiceEmailService = (
  options: InvoiceEmailServiceOptions = {}
): InvoiceEmailService => {
  const transporter = options.transporter ?? createLazyDefaultTransporter()
  const fromAddress = process.env.EMAIL_FROM || "Billing <billing@yourapp.com>"

  return {
    async sendInvoiceCreated(invoice, recipientEmail) {
      try {
        const html = await render(
          <InvoiceCreatedEmail {...getInvoiceEmailData(invoice)} />
        )

        await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: `Invoice ${invoice.invoiceNumber} - Payment Due ${invoice.dueAt}`,
          html,
        })
      } catch (error) {
        console.error("Failed to send invoice created email:", error)
        throw new InvoiceEmailServiceError(
          `Failed to send invoice created notification: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },

    async sendPaymentReminder(invoice, recipientEmail) {
      try {
        const html = await render(
          <PaymentReminderEmail {...getInvoiceEmailData(invoice)} />
        )

        await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: `Reminder: Invoice ${invoice.invoiceNumber} Due Soon`,
          html,
        })
      } catch (error) {
        console.error("Failed to send payment reminder email:", error)
        throw new InvoiceEmailServiceError(
          `Failed to send payment reminder notification: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },

    async sendInvoicePaid(invoice, recipientEmail) {
      try {
        const html = await render(
          <InvoicePaidEmail {...getInvoiceEmailData(invoice)} />
        )

        await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: `Payment Received - Invoice ${invoice.invoiceNumber}`,
          html,
        })
      } catch (error) {
        console.error("Failed to send invoice paid email:", error)
        throw new InvoiceEmailServiceError(
          `Failed to send invoice paid notification: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },

    async sendInvoiceOverdue(invoice, recipientEmail) {
      try {
        const html = await render(
          <InvoiceOverdueEmail {...getInvoiceEmailData(invoice)} />
        )

        await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: `OVERDUE: Invoice ${invoice.invoiceNumber} Payment Required`,
          html,
        })
      } catch (error) {
        console.error("Failed to send invoice overdue email:", error)
        throw new InvoiceEmailServiceError(
          `Failed to send invoice overdue notification: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },

    async sendInvoiceCancelled(invoice, recipientEmail, reason) {
      try {
        const html = await render(
          <InvoiceCancelledEmail
            {...getInvoiceEmailData(invoice)}
            reason={reason}
          />
        )

        await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          subject: `Invoice ${invoice.invoiceNumber} Has Been Cancelled`,
          html,
        })
      } catch (error) {
        console.error("Failed to send invoice cancelled email:", error)
        throw new InvoiceEmailServiceError(
          `Failed to send invoice cancelled notification: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },
  }
}

export const invoiceEmailService = createInvoiceEmailService()
