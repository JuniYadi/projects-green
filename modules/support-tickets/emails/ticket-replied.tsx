import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { SupportTicket, SupportTicketReply } from "../support-ticket.types"
import { SUPPORT_TICKET_STATUS_LABELS } from "../support-ticket.types"

interface TicketRepliedEmailProps {
  ticket: SupportTicket
  reply: SupportTicketReply
}

export const TicketRepliedEmail = ({ ticket, reply }: TicketRepliedEmailProps) => {
  const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3300"}/console/support-tickets/${ticket.id}`

  return (
    <Html>
      <Head />
      <Preview>
        Re: Support ticket #{ticket.ticketNumber} - {ticket.subject}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            Re: Support Ticket #{ticket.ticketNumber}
          </Heading>

          <Text style={styles.intro}>
            A member of our support team has replied to your ticket.
          </Text>

          <Section style={styles.ticketInfo}>
            <Heading as="h3" style={styles.ticketSubject}>
              {ticket.subject}
            </Heading>

            <Text style={styles.meta}>
              <strong>Status:</strong> {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
            </Text>
          </Section>

          <Section style={styles.replyPreview}>
            <Text style={styles.replyLabel}>Reply:</Text>
            <Text style={styles.replyBody}>{reply.body}</Text>
          </Section>

          <Hr style={styles.divider} />

          <Section style={styles.actions}>
            <Button href={ticketUrl} style={styles.button}>
              View Full Conversation
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            You can reply directly to this email to add more information to your ticket.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    margin: "40px auto",
    padding: "40px",
    maxWidth: "600px",
  },
  heading: {
    color: "#1a1a1a",
    fontSize: "24px",
    fontWeight: "600" as const,
    margin: "0 0 24px 0",
  },
  intro: {
    color: "#525f7f",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0 0 24px 0",
  },
  ticketInfo: {
    backgroundColor: "#f6f9fc",
    borderRadius: "6px",
    padding: "24px",
    margin: "0 0 24px 0",
  },
  ticketSubject: {
    color: "#1a1a1a",
    fontSize: "18px",
    fontWeight: "600" as const,
    margin: "0 0 16px 0",
  },
  meta: {
    color: "#525f7f",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "8px 0",
  },
  replyPreview: {
    backgroundColor: "#ffffff",
    border: "1px solid #e6ebf1",
    borderRadius: "6px",
    padding: "24px",
    margin: "0 0 24px 0",
  },
  replyLabel: {
    color: "#8898aa",
    fontSize: "12px",
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    margin: "0 0 8px 0",
  },
  replyBody: {
    color: "#1a1a1a",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0",
    whiteSpace: "pre-wrap" as const,
  },
  divider: {
    borderColor: "#e6ebf1",
    borderWidth: "1px",
    margin: "24px 0",
  },
  actions: {
    textAlign: "center" as const,
    margin: "24px 0",
  },
  button: {
    backgroundColor: "#5469d4",
    borderRadius: "4px",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "600" as const,
    padding: "12px 24px",
    textDecoration: "none",
  },
  footer: {
    color: "#8898aa",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0",
  },
}