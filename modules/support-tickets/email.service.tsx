import { render } from "@react-email/components"

import { TicketCreatedEmail } from "./emails/ticket-created"
import { TicketRepliedEmail } from "./emails/ticket-replied"
import { TicketClosedEmail } from "./emails/ticket-closed"
import type { SupportTicket, SupportTicketReply } from "./support-ticket.types"
import { SUPPORT_TICKET_STATUS_LABELS } from "./support-ticket.types"
import { sendEmail } from "@/lib/queue/email"

export class EmailServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmailServiceError"
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
}

// ponytail: no more nodemailer transporter — queue worker handles SMTP
export const createEmailService = (): EmailService => ({
  async sendTicketCreated(ticket: SupportTicket, requesterEmail: string) {
    try {
      const html = await render(<TicketCreatedEmail ticket={ticket} />)

      sendEmail({
        to: requesterEmail,
        subject: `Your support ticket #${ticket.ticketNumber} has been created`,
        html,
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

      sendEmail({
        to: requesterEmail,
        subject: `Re: Support ticket #${ticket.ticketNumber} - ${ticket.subject}`,
        html,
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

      sendEmail({
        to: requesterEmail,
        subject: `Support ticket #${ticket.ticketNumber} has been ${SUPPORT_TICKET_STATUS_LABELS[ticket.status].toLowerCase()}`,
        html,
      })
    } catch (error) {
      console.error("Failed to send ticket closed email:", error)
      throw new EmailServiceError(
        `Failed to send ticket closed notification: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  },
})

export const emailService = createEmailService()
