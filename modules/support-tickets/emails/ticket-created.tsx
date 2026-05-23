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
import { SUPPORT_TICKET_DEPARTMENT_LABELS } from "../support-ticket.types"
import { SUPPORT_TICKET_PRIORITY_LABELS } from "../support-ticket.types"
import { SUPPORT_TICKET_STATUS_LABELS } from "../support-ticket.types"

interface TicketCreatedEmailProps {
  ticket: SupportTicket
}

export const TicketCreatedEmail = ({ ticket }: TicketCreatedEmailProps) => {
  const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3300"}/console/support-tickets/${ticket.id}`

  return (
    <Html>
      <Head />
      <Preview>
        Your support ticket #{ticket.ticketNumber} has been created
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            Support Ticket #{ticket.ticketNumber}
          </Heading>

          <Text style={styles.intro}>
            We&apos;ve received your support request and our team will review it shortly.
          </Text>

          <Section style={styles.ticketInfo}>
            <Heading as="h3" style={styles.ticketSubject}>
              {ticket.subject}
            </Heading>

            <Text style={styles.meta}>
              <strong>Status:</strong> {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
            </Text>
            <Text style={styles.meta}>
              <strong>Department:</strong> {SUPPORT_TICKET_DEPARTMENT_LABELS[ticket.department]}
            </Text>
            <Text style={styles.meta}>
              <strong>Priority:</strong> {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
            </Text>
            {ticket.service && (
              <Text style={styles.meta}>
                <strong>Service:</strong> {ticket.service}
              </Text>
            )}
          </Section>

          <Hr style={styles.divider} />

          <Section style={styles.actions}>
            <Button href={ticketUrl} style={styles.button}>
              View Ticket
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            If you have additional information to add, please reply to this email or visit your support dashboard.
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