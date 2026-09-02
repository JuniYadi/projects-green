import { render } from "react-email"

import { createEmailLog } from "@/lib/email-log"
import { TicketCreatedEmail } from "./emails/ticket-created"
import { TicketRepliedEmail } from "./emails/ticket-replied"
import { TicketClosedEmail } from "./emails/ticket-closed"
import { TicketNewAdminAlertEmail } from "./emails/ticket-new-admin-alert"
import type { SupportTicket, SupportTicketReply } from "./support-ticket.types"
import { SUPPORT_TICKET_STATUS_LABELS } from "./support-ticket.types"
import { sendEmail } from "@/lib/queue/email"

export class EmailServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmailServiceError"
  }
}

export type TicketOrganizationEmailContext = {
  organizationId: string
  organizationName: string | null
  organizationUrl?: string
}

export type TicketReplyEmailContext = {
  authorName: string
  authorRole: "Requester" | "Support Admin"
  hasSecureDetails: boolean
  repliedAt: Date
}

export type EmailService = {
  sendTicketCreated(
    ticket: SupportTicket,
    requesterEmail: string,
    organization?: TicketOrganizationEmailContext
  ): Promise<void>
  sendTicketReplied(
    ticket: SupportTicket,
    reply: SupportTicketReply,
    requesterEmail: string,
    replyContext?: TicketReplyEmailContext
  ): Promise<void>
  sendTicketClosed(ticket: SupportTicket, requesterEmail: string): Promise<void>
  sendNewTicketAlertToStaff(
    ticket: SupportTicket,
    adminEmail: string,
    requesterName?: string,
    requesterEmail?: string,
    organization?: TicketOrganizationEmailContext
  ): Promise<void>
  sendTicketReplyAlertToStaff(
    ticket: SupportTicket,
    reply: SupportTicketReply,
    adminEmail: string,
    requesterEmail?: string,
    replyContext?: TicketReplyEmailContext
  ): Promise<void>
}

// ponytail: no more nodemailer transporter — queue worker handles SMTP
export const createEmailService = (): EmailService => ({
  async sendTicketCreated(
    ticket: SupportTicket,
    requesterEmail: string,
    organization?: TicketOrganizationEmailContext
  ) {
    try {
      const html = await render(
        <TicketCreatedEmail ticket={ticket} organization={organization} />
      )
      const subject = `Your support ticket #${ticket.ticketNumber} has been created`
      const emailLogId = await createEmailLog({
        recipientEmail: requesterEmail,
        type: "TICKET_CREATED",
        subject,
        bodyHtml: html,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        organizationId: ticket.organizationId,
        relatedEntityType: "support_ticket",
        relatedEntityId: ticket.id,
      })

      await sendEmail({
        to: requesterEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send ticket created email:", error)
      throw new EmailServiceError(
        `Failed to send ticket created notification: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  async sendTicketReplied(
    ticket: SupportTicket,
    reply: SupportTicketReply,
    requesterEmail: string,
    replyContext?: TicketReplyEmailContext
  ) {
    try {
      const html = await render(
        <TicketRepliedEmail
          ticket={ticket}
          reply={reply}
          replyContext={replyContext}
        />
      )
      const subject = `Re: Support ticket #${ticket.ticketNumber} - ${ticket.subject}`
      const emailLogId = await createEmailLog({
        recipientEmail: requesterEmail,
        type: "TICKET_REPLIED",
        subject,
        bodyHtml: html,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        organizationId: ticket.organizationId,
        relatedEntityType: "support_ticket",
        relatedEntityId: ticket.id,
      })

      await sendEmail({
        to: requesterEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send ticket replied email:", error)
      throw new EmailServiceError(
        `Failed to send ticket replied notification: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  async sendTicketClosed(ticket: SupportTicket, requesterEmail: string) {
    try {
      const html = await render(<TicketClosedEmail ticket={ticket} />)
      const subject = `Support ticket #${ticket.ticketNumber} has been ${SUPPORT_TICKET_STATUS_LABELS[ticket.status].toLowerCase()}`
      const emailLogId = await createEmailLog({
        recipientEmail: requesterEmail,
        type: "TICKET_CLOSED",
        subject,
        bodyHtml: html,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        organizationId: ticket.organizationId,
        relatedEntityType: "support_ticket",
        relatedEntityId: ticket.id,
      })

      await sendEmail({
        to: requesterEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send ticket closed email:", error)
      throw new EmailServiceError(
        `Failed to send ticket closed notification: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  async sendNewTicketAlertToStaff(
    ticket: SupportTicket,
    adminEmail: string,
    requesterName?: string,
    requesterEmail?: string,
    organization?: TicketOrganizationEmailContext
  ) {
    try {
      const html = await render(
        <TicketNewAdminAlertEmail
          ticket={ticket}
          requesterName={requesterName}
          requesterEmail={requesterEmail}
          organization={organization}
        />
      )
      const subject = `[Action Required] New support ticket #${ticket.ticketNumber} - ${ticket.subject}`
      const emailLogId = await createEmailLog({
        recipientEmail: adminEmail,
        type: "TICKET_ADMIN_ALERT",
        subject,
        bodyHtml: html,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        organizationId: ticket.organizationId,
        relatedEntityType: "support_ticket",
        relatedEntityId: ticket.id,
      })

      await sendEmail({
        to: adminEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send admin ticket alert email:", error)
      throw new EmailServiceError(
        `Failed to send admin ticket alert: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },

  async sendTicketReplyAlertToStaff(
    ticket: SupportTicket,
    reply: SupportTicketReply,
    adminEmail: string,
    requesterEmail?: string,
    replyContext?: TicketReplyEmailContext
  ) {
    try {
      const html = await render(
        <TicketNewAdminAlertEmail
          ticket={ticket}
          requesterEmail={requesterEmail}
          variant="reply"
          reply={reply}
          replyContext={replyContext}
        />
      )
      const subject = `[Action Required] New reply on support ticket #${ticket.ticketNumber} - ${ticket.subject}`
      const emailLogId = await createEmailLog({
        recipientEmail: adminEmail,
        type: "TICKET_ADMIN_ALERT",
        subject,
        bodyHtml: html,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        organizationId: ticket.organizationId,
        relatedEntityType: "support_ticket",
        relatedEntityId: ticket.id,
      })

      await sendEmail({
        to: adminEmail,
        subject,
        html,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send admin ticket reply alert email:", error)
      throw new EmailServiceError(
        `Failed to send admin ticket reply alert: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },
})

export const emailService = createEmailService()
