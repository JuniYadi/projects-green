import { render } from "@react-email/components"
import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

import { TicketCreatedEmail } from "./emails/ticket-created"
import { TicketRepliedEmail } from "./emails/ticket-replied"
import { TicketClosedEmail } from "./emails/ticket-closed"
import type {
  SupportTicket,
  SupportTicketReply,
} from "./support-ticket.types"
import { SUPPORT_TICKET_STATUS_LABELS } from "./support-ticket.types"

export class EmailServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmailServiceError"
  }
}

export type EmailService = {
  sendTicketCreated(
    ticket: SupportTicket,
    requesterEmail: string,
  ): Promise<void>
  sendTicketReplied(
    ticket: SupportTicket,
    reply: SupportTicketReply,
    requesterEmail: string,
  ): Promise<void>
  sendTicketClosed(
    ticket: SupportTicket,
    requesterEmail: string,
  ): Promise<void>
}

type EmailServiceOptions = {
  transporter?: Transporter
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

export const createEmailService = (
  options: EmailServiceOptions = {},
): EmailService => {
  const transporter = options.transporter ?? createLazyDefaultTransporter()

  return {
    async sendTicketCreated(ticket: SupportTicket, requesterEmail: string) {
      try {
        const html = await render(
          <TicketCreatedEmail ticket={ticket} />,
        )

        await transporter.sendMail({
          from: process.env.EMAIL_FROM || "Support <support@yourapp.com>",
          to: requesterEmail,
          subject: `Your support ticket #${ticket.ticketNumber} has been created`,
          html,
        })
      } catch (error) {
        console.error("Failed to send ticket created email:", error)
        throw new EmailServiceError(
          `Failed to send ticket created notification: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    },

    async sendTicketReplied(
      ticket: SupportTicket,
      reply: SupportTicketReply,
      requesterEmail: string,
    ) {
      try {
        const html = await render(
          <TicketRepliedEmail ticket={ticket} reply={reply} />,
        )

        await transporter.sendMail({
          from: process.env.EMAIL_FROM || "Support <support@yourapp.com>",
          to: requesterEmail,
          subject: `Re: Support ticket #${ticket.ticketNumber} - ${ticket.subject}`,
          html,
        })
      } catch (error) {
        console.error("Failed to send ticket replied email:", error)
        throw new EmailServiceError(
          `Failed to send ticket replied notification: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    },

    async sendTicketClosed(ticket: SupportTicket, requesterEmail: string) {
      try {
        const html = await render(
          <TicketClosedEmail ticket={ticket} />,
        )

        await transporter.sendMail({
          from: process.env.EMAIL_FROM || "Support <support@yourapp.com>",
          to: requesterEmail,
          subject: `Support ticket #${ticket.ticketNumber} has been ${SUPPORT_TICKET_STATUS_LABELS[ticket.status].toLowerCase()}`,
          html,
        })
      } catch (error) {
        console.error("Failed to send ticket closed email:", error)
        throw new EmailServiceError(
          `Failed to send ticket closed notification: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    },
  }
}

export const emailService = createEmailService()