import { render } from "@react-email/components"

import { InvoiceCreatedEmail } from "@/modules/invoices/emails/invoice-created"
import { InvoicePaidEmail } from "@/modules/invoices/emails/invoice-paid"
import { InvoiceOverdueEmail } from "@/modules/invoices/emails/invoice-overdue"
import { InvoiceCancelledEmail } from "@/modules/invoices/emails/invoice-cancelled"
import { PaymentReminderEmail } from "@/modules/invoices/emails/payment-reminder"
import { TicketCreatedEmail } from "@/modules/support-tickets/emails/ticket-created"
import { TicketRepliedEmail } from "@/modules/support-tickets/emails/ticket-replied"
import { TicketClosedEmail } from "@/modules/support-tickets/emails/ticket-closed"

export type EmailTemplateCategory = "Invoice" | "Support"

export type EmailTemplateMeta = {
  id: string
  name: string
  category: EmailTemplateCategory
  subject: string
  from: string
}

// ponytail: mock data baked in — no DB, no env lookup needed for preview
const INVOICE_MOCK = {
  invoiceNumber: "INV-2026-001",
  amount: "USD 150.00",
  currency: "USD",
  status: "OPEN",
  issuedAt: "Jan 1, 2026",
  dueAt: "Jan 15, 2026",
  periodStart: "Jan 1, 2026",
  periodEnd: "Jan 31, 2026",
}

const TICKET_MOCK = {
  id: "clxyz001",
  ticketNumber: "TKT-0042",
  subject: "Cannot connect to VPN server",
  description: "I keep getting a timeout when connecting to the VPN.",
  descriptionHtml: null,
  secureForm: null,
  department: "technical" as const,
  priority: "high" as const,
  status: "open" as const,
  service: "billing" as const,
  organizationId: "org_preview",
  organizationName: "Acme Corp",
  organizationMetadata: null,
  assignedAgentWorkosUserId: null,
  requesterWorkosUserId: "user_preview",
  attachmentMetadata: [],
  createdAt: new Date("2026-01-10T08:00:00Z"),
  updatedAt: new Date("2026-01-10T08:00:00Z"),
  closedAt: null,
  resolvedAt: null,
}

const REPLY_MOCK = {
  id: "reply_001",
  ticketId: "clxyz001",
  authorWorkosUserId: "agent_preview",
  body: "Hi, we've investigated the issue and found a config error on your end. Please try resetting your VPN client and reconnecting.",
  bodyHtml: null,
  isInternalNote: false,
  secureForm: null,
  attachmentMetadata: [],
  createdAt: new Date("2026-01-10T10:00:00Z"),
  updatedAt: new Date("2026-01-10T10:00:00Z"),
}

export const EMAIL_TEMPLATES: EmailTemplateMeta[] = [
  {
    id: "invoice-created",
    name: "Invoice Created",
    category: "Invoice",
    subject: "Invoice {{invoiceNumber}} - Payment Due {{dueAt}}",
    from: "billing@yourapp.com",
  },
  {
    id: "invoice-paid",
    name: "Invoice Paid",
    category: "Invoice",
    subject: "Payment Received - Invoice {{invoiceNumber}}",
    from: "billing@yourapp.com",
  },
  {
    id: "invoice-overdue",
    name: "Invoice Overdue",
    category: "Invoice",
    subject: "OVERDUE: Invoice {{invoiceNumber}} Payment Required",
    from: "billing@yourapp.com",
  },
  {
    id: "invoice-cancelled",
    name: "Invoice Cancelled",
    category: "Invoice",
    subject: "Invoice {{invoiceNumber}} Has Been Cancelled",
    from: "billing@yourapp.com",
  },
  {
    id: "payment-reminder",
    name: "Payment Reminder",
    category: "Invoice",
    subject: "Reminder: Invoice {{invoiceNumber}} Due Soon",
    from: "billing@yourapp.com",
  },
  {
    id: "ticket-created",
    name: "Ticket Created",
    category: "Support",
    subject: "Your support ticket #{{ticketNumber}} has been created",
    from: "support@yourapp.com",
  },
  {
    id: "ticket-replied",
    name: "Ticket Replied",
    category: "Support",
    subject: "Re: Support ticket #{{ticketNumber}} - {{subject}}",
    from: "support@yourapp.com",
  },
  {
    id: "ticket-closed",
    name: "Ticket Closed",
    category: "Support",
    subject: "Support ticket #{{ticketNumber}} has been closed",
    from: "support@yourapp.com",
  },
]

export async function renderEmailTemplate(id: string): Promise<string> {
  switch (id) {
    case "invoice-created":
      return render(<InvoiceCreatedEmail {...INVOICE_MOCK} />)
    case "invoice-paid":
      return render(<InvoicePaidEmail {...INVOICE_MOCK} />)
    case "invoice-overdue":
      return render(<InvoiceOverdueEmail {...INVOICE_MOCK} />)
    case "invoice-cancelled":
      return render(
        <InvoiceCancelledEmail
          {...INVOICE_MOCK}
          reason="Customer requested cancellation"
        />
      )
    case "payment-reminder":
      return render(<PaymentReminderEmail {...INVOICE_MOCK} />)
    case "ticket-created":
      return render(<TicketCreatedEmail ticket={TICKET_MOCK} />)
    case "ticket-replied":
      return render(
        <TicketRepliedEmail ticket={TICKET_MOCK} reply={REPLY_MOCK} />
      )
    case "ticket-closed":
      return render(<TicketClosedEmail ticket={TICKET_MOCK} />)
    default:
      return ""
  }
}
