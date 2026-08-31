import { render } from "@react-email/components"

import { InvoiceCancelledEmail } from "@/modules/invoices/emails/invoice-cancelled"
import { InvoiceCreatedEmail } from "@/modules/invoices/emails/invoice-created"
import { InvoiceOverdueEmail } from "@/modules/invoices/emails/invoice-overdue"
import { InvoicePaidEmail } from "@/modules/invoices/emails/invoice-paid"
import { PaymentConfirmationSubmittedEmail } from "@/modules/invoices/emails/payment-confirmation-submitted"
import { PaymentReminderEmail } from "@/modules/invoices/emails/payment-reminder"
import { TicketClosedEmail } from "@/modules/support-tickets/emails/ticket-closed"
import { TicketCreatedEmail } from "@/modules/support-tickets/emails/ticket-created"
import { TicketNewAdminAlertEmail } from "@/modules/support-tickets/emails/ticket-new-admin-alert"
import { TicketRepliedEmail } from "@/modules/support-tickets/emails/ticket-replied"
import { ProvisioningFailedEmail } from "@/modules/vpn/emails/provisioning-failed"
import { ProvisioningSuccessEmail } from "@/modules/vpn/emails/provisioning-success"
import { RenewalFailedEmail } from "@/modules/vpn/emails/renewal-failed"
import { RenewalSuccessEmail } from "@/modules/vpn/emails/renewal-success"
import { SubscriptionCancelledEmail } from "@/modules/vpn/emails/subscription-cancelled"
import { SubscriptionCreatedEmail } from "@/modules/vpn/emails/subscription-created"
import { SubscriptionExpiredEmail } from "@/modules/vpn/emails/subscription-expired"
import { SubscriptionSuspendedEmail } from "@/modules/vpn/emails/subscription-suspended"
import { DailyDeviceDigestEmail } from "@/modules/whatsapp/emails/daily-device-digest"
import { DeviceDisconnectedEmail } from "@/modules/whatsapp/emails/device-disconnected"
import { DeviceStateChangeEmail } from "@/modules/whatsapp/emails/device-state-change"

export type EmailTemplateCategory = "Invoice" | "Support" | "VPN" | "WhatsApp"

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
  amount: "$150.00",
  currency: "USD",
  status: "Open",
  issuedAt: "January 1, 2026",
  dueAt: "January 15, 2026",
  periodStart: "January 1, 2026",
  periodEnd: "January 31, 2026",
  subtotalAmount: "$140.00",
  taxAmount: "$10.00",
  discountAmount: "$0.00",
  recipientEmail: "billing@acme.corp",
  organizationName: "Acme Corporation",
  paymentMethod: "Bank Transfer",
  paidAt: "January 12, 2026",
  lineItems: [
    {
      id: "li_1",
      description: "VPN Enterprise Plan - Singapore Gateway (Monthly)",
      quantity: 1,
      unitPrice: "$120.00",
      amount: "$120.00",
    },
    {
      id: "li_2",
      description: "Dedicated Static IPv4 Add-on",
      quantity: 2,
      unitPrice: "$10.00",
      amount: "$20.00",
    },
  ],
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
  // Invoices
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
    id: "payment-confirmation-submitted",
    name: "Payment Confirmation Submitted",
    category: "Invoice",
    subject: "Payment Confirmation Received for Invoice {{invoiceNumber}}",
    from: "billing@yourapp.com",
  },

  // Support
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
  {
    id: "ticket-new-admin-alert",
    name: "Ticket Staff Alert",
    category: "Support",
    subject: "New support ticket #{{ticketNumber}} - {{subject}}",
    from: "support@yourapp.com",
  },

  // VPN
  {
    id: "vpn-subscription-created",
    name: "VPN Subscription Created",
    category: "VPN",
    subject: "Your VPN subscription is being provisioned",
    from: "support@yourapp.com",
  },
  {
    id: "vpn-provisioning-success",
    name: "VPN Provisioning Success",
    category: "VPN",
    subject: "Your VPN account is ready",
    from: "support@yourapp.com",
  },
  {
    id: "vpn-provisioning-failed",
    name: "VPN Provisioning Failed",
    category: "VPN",
    subject: "VPN Account Setup Issue",
    from: "support@yourapp.com",
  },
  {
    id: "vpn-renewal-success",
    name: "VPN Renewal Success",
    category: "VPN",
    subject: "VPN Subscription Renewed Successfully",
    from: "billing@yourapp.com",
  },
  {
    id: "vpn-renewal-failed",
    name: "VPN Renewal Failed",
    category: "VPN",
    subject: "Action Required: VPN Subscription Renewal Failed",
    from: "billing@yourapp.com",
  },
  {
    id: "vpn-subscription-suspended",
    name: "VPN Subscription Suspended",
    category: "VPN",
    subject: "Your VPN subscription has been suspended",
    from: "billing@yourapp.com",
  },
  {
    id: "vpn-subscription-expired",
    name: "VPN Subscription Expired",
    category: "VPN",
    subject: "Your VPN subscription has expired",
    from: "billing@yourapp.com",
  },
  {
    id: "vpn-subscription-cancelled",
    name: "VPN Subscription Cancelled",
    category: "VPN",
    subject: "Your VPN subscription has been cancelled",
    from: "billing@yourapp.com",
  },

  // WhatsApp
  {
    id: "whatsapp-device-state-change",
    name: "WhatsApp Device State Change",
    category: "WhatsApp",
    subject: "WhatsApp Device State Changed - {{deviceName}}",
    from: "alerts@yourapp.com",
  },
  {
    id: "whatsapp-device-disconnected",
    name: "WhatsApp Device Disconnected",
    category: "WhatsApp",
    subject: "WhatsApp Device Disconnected - {{deviceName}}",
    from: "alerts@yourapp.com",
  },
  {
    id: "whatsapp-daily-device-digest",
    name: "WhatsApp Daily Device Digest",
    category: "WhatsApp",
    subject: "Daily WhatsApp Device Digest",
    from: "alerts@yourapp.com",
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
    case "payment-confirmation-submitted":
      return render(
        <PaymentConfirmationSubmittedEmail
          invoiceNumber="INV-2026-001"
          amount="$150.00"
          bankName="Bank Central Asia (BCA)"
          senderName="John Doe"
          confirmationId="conf_abc123"
        />
      )

    case "ticket-created":
      return render(<TicketCreatedEmail ticket={TICKET_MOCK} />)
    case "ticket-replied":
      return render(
        <TicketRepliedEmail ticket={TICKET_MOCK} reply={REPLY_MOCK} />
      )
    case "ticket-closed":
      return render(<TicketClosedEmail ticket={TICKET_MOCK} />)
    case "ticket-new-admin-alert":
      return render(
        <TicketNewAdminAlertEmail
          ticket={TICKET_MOCK}
          requesterName="John Doe"
          requesterEmail="john@acme.corp"
          variant="created"
          organization={{
            organizationId: "org_preview",
            organizationName: "Acme Corporation",
          }}
        />
      )

    case "vpn-subscription-created":
      return render(
        <SubscriptionCreatedEmail
          organizationName="Acme Corporation"
          packageName="Enterprise VPN"
        />
      )
    case "vpn-provisioning-success":
      return render(
        <ProvisioningSuccessEmail
          organizationName="Acme Corporation"
          packageName="Enterprise VPN"
        />
      )
    case "vpn-provisioning-failed":
      return render(
        <ProvisioningFailedEmail
          organizationName="Acme Corporation"
          packageName="Enterprise VPN"
        />
      )
    case "vpn-renewal-success":
      return render(
        <RenewalSuccessEmail
          organizationName="Acme Corporation"
          packageName="Enterprise VPN"
        />
      )
    case "vpn-renewal-failed":
      return render(
        <RenewalFailedEmail
          organizationName="Acme Corporation"
          packageName="Enterprise VPN"
        />
      )
    case "vpn-subscription-suspended":
      return render(
        <SubscriptionSuspendedEmail
          organizationName="Acme Corporation"
          packageName="Enterprise VPN"
        />
      )
    case "vpn-subscription-expired":
      return render(
        <SubscriptionExpiredEmail
          organizationName="Acme Corporation"
          packageName="Enterprise VPN"
        />
      )
    case "vpn-subscription-cancelled":
      return render(
        <SubscriptionCancelledEmail
          organizationName="Acme Corporation"
          packageName="Enterprise VPN"
        />
      )

    case "whatsapp-device-state-change":
      return render(
        <DeviceStateChangeEmail
          deviceName="Primary Support WA"
          phoneNumber="+6281234567890"
          orgName="Acme Corporation"
          changes={[
            {
              field: "Status",
              oldValue: "CONNECTED",
              newValue: "DISCONNECTED",
            },
          ]}
          changedAt="January 15, 2026 14:30 UTC"
        />
      )
    case "whatsapp-device-disconnected":
      return render(
        <DeviceDisconnectedEmail
          deviceName="Primary Support WA"
          phoneNumber="+6281234567890"
          orgName="Acme Corporation"
          lastHeartbeatAt="January 15, 2026 14:00 UTC"
          disconnectedAt="January 15, 2026 14:30 UTC"
        />
      )
    case "whatsapp-daily-device-digest":
      return render(
        <DailyDeviceDigestEmail
          devices={[
            {
              id: "dev_1",
              phoneNumber: "+6281234567890",
              displayName: "Support Hotline",
              orgName: "Acme Corporation",
              nameStatus: "APPROVED",
              qualityRating: "GREEN",
              status: "CONNECTED",
            },
          ]}
          generatedAt="January 15, 2026 00:00 UTC"
          stats={{
            total: 1,
            approved: 1,
            pending: 0,
            declinedOrExpired: 0,
            active: 1,
          }}
        />
      )

    default:
      return ""
  }
}
