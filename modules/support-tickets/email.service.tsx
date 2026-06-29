import { render } from "@react-email/components"

import { TicketCreatedEmail } from "./emails/ticket-created"
import { TicketRepliedEmail } from "./emails/ticket-replied"
import { TicketClosedEmail } from "./emails/ticket-closed"
import { TicketNewAdminAlertEmail } from "./emails/ticket-new-admin-alert"
import type { SupportTicket, SupportTicketReply } from "./support-ticket.types"
import { SUPPORT_TICKET_STATUS_LABELS } from "./support-ticket.types"
import { sendEmail } from "@/lib/queue/email"
import { prisma } from "@/lib/prisma"

export class EmailServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmailServiceError"
  }
}

type EmailLogType = "TICKET_CREATED" | "TICKET_REPLIED" | "TICKET_CLOSED" | "TICKET_ADMIN_ALERT"

async function createEmailLog(
  ticketId: string | null,
  ticketNumber: string | null,
  recipientEmail: string,
  type: EmailLogType,
  subject: string
) {
  try {
    const log = await prisma.emailLog.create({
      data: {
        ticketId,
        ticketNumber,
        recipientEmail,
        type,
        subject,
        status: "QUEUED",
      },
    })
    return log.id
  } catch (err) {
    console.error("[EmailService] Failed to create email log:", err)
    return null
  }
}

export type EmailService = {
  sendTicketCreated(
    ticket: SupportTicket,
    requesterEmail: string
  ): Promise<void>
  sendTicketReplied(
    ticket: SupportTicket,
    reply: SupportTicketReply,
    requesterEmail: string
  ): Promise<void>
  sendTicketClosed(ticket: SupportTicket, requesterEmail: string): Promise<void>
  sendNewTicketAlertToStaff(
    ticket: SupportTicket,
    adminEmail: string,
    requesterName?: string,
    requesterEmail?: string
  ): Promise<void>
}

// ponytail: no more nodemailer transporter — queue worker handles SMTP
export const createEmailService = (): EmailService => ({
  async sendTicketCreated(ticket: SupportTicket, requesterEmail: string) {
    try {
      const html = await render(<TicketCreatedEmail ticket={ticket} />)
      const subject = `Your support ticket #${ticket.ticketNumber} has been created`
      const emailLogId = await createEmailLog(ticket.id, ticket.ticketNumber, requesterEmail, "TICKET_CREATED", subject)

      await sendEmail({
        to: requesterEmail,
        subject,
        html,
        from: "Support <support@yourapp.com>",
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
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
    requesterEmail: string
  ) {
    try {
      const html = await render(
        <TicketRepliedEmail ticket={ticket} reply={reply} />
      )
      const subject = `Re: Support ticket #${ticket.ticketNumber} - ${ticket.subject}`
      const emailLogId = await createEmailLog(ticket.id, ticket.ticketNumber, requesterEmail, "TICKET_REPLIED", subject)

      await sendEmail({
        to: requesterEmail,
        subject,
        html,
        from: "Support <support@yourapp.com>",
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
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
      const emailLogId = await createEmailLog(ticket.id, ticket.ticketNumber, requesterEmail, "TICKET_CLOSED", subject)

      await sendEmail({
        to: requesterEmail,
        subject,
        html,
        from: "Support <support@yourapp.com>",
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
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
    requesterEmail?: string
  ) {
    try {
      const html = await render(
        <TicketNewAdminAlertEmail
          ticket={ticket}
          requesterName={requesterName}
          requesterEmail={requesterEmail}
        />
      )
      const subject = `[Action Required] New support ticket #${ticket.ticketNumber} - ${ticket.subject}`
      const emailLogId = await createEmailLog(ticket.id, ticket.ticketNumber, adminEmail, "TICKET_ADMIN_ALERT", subject)

      await sendEmail({
        to: adminEmail,
        subject,
        html,
        from: "Support <support@yourapp.com>",
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        emailLogId: emailLogId ?? undefined,
      })
    } catch (error) {
      console.error("Failed to send admin ticket alert email:", error)
      throw new EmailServiceError(
        `Failed to send admin ticket alert: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },
})

export const emailService = createEmailService()
