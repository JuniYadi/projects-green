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
import type { SupportTicket } from "../support-ticket.types"
import { SUPPORT_TICKET_STATUS_LABELS } from "../support-ticket.types"

interface TicketClosedEmailProps {
  ticket: SupportTicket
}

export const TicketClosedEmail = ({ ticket }: TicketClosedEmailProps) => {
  const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3300"}/console/support-tickets/${ticket.id}`
  const statusLabel = SUPPORT_TICKET_STATUS_LABELS[ticket.status]
  const isResolved = ticket.status === "resolved"

  return (
    <Html>
      <Head />
      <Preview>
        Support ticket #{ticket.ticketNumber} has been {statusLabel.toLowerCase()}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            Support Ticket #{ticket.ticketNumber} {statusLabel}
          </Heading>

          <Text style={styles.intro}>
            {isResolved
              ? "Your support ticket has been resolved. If you need further assistance, you can reopen it."
              : "Your support ticket has been closed. Thank you for reaching out to us."}
          </Text>

          <Section style={styles.ticketInfo}>
            <Heading as="h3" style={styles.ticketSubject}>
              {ticket.subject}
            </Heading>

            <Text style={styles.meta}>
              <strong>Final Status:</strong> {statusLabel}
            </Text>
            {ticket.resolvedAt && (
              <Text style={styles.meta}>
                <strong>Resolved:</strong> {new Date(ticket.resolvedAt).toLocaleDateString()}
              </Text>
            )}
            {ticket.closedAt && (
              <Text style={styles.meta}>
                <strong>Closed:</strong> {new Date(ticket.closedAt).toLocaleDateString()}
              </Text>
            )}
          </Section>

          <Hr style={styles.divider} />

          <Section style={styles.actions}>
            {isResolved && (
              <Text style={styles.reopenNote}>
                Need more help? You can reopen this ticket by replying to this email or visiting the ticket page.
              </Text>
            )}
            <Button href={ticketUrl} style={styles.button}>
              View Ticket
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            Thank you for using our support services. If you have any other questions, please don&apos;t hesitate to reach out.
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
  divider: {
    borderColor: "#e6ebf1",
    borderWidth: "1px",
    margin: "24px 0",
  },
  actions: {
    textAlign: "center" as const,
    margin: "24px 0",
  },
  reopenNote: {
    color: "#525f7f",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 16px 0",
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