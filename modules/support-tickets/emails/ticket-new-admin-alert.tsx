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

interface TicketNewAdminAlertEmailProps {
  ticket: SupportTicket
  requesterName?: string
  requesterEmail?: string
}

export const TicketNewAdminAlertEmail = ({
  ticket,
  requesterName,
  requesterEmail,
}: TicketNewAdminAlertEmailProps) => {
  const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3300"}/portal/support-tickets/${ticket.id}`

  return (
    <Html>
      <Head />
      <Preview>
        New support ticket #{ticket.ticketNumber} - {ticket.subject}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            New Support Ticket #{ticket.ticketNumber}
          </Heading>

          <Section style={styles.alertBox}>
            <Text style={styles.alertText}>
              A new support ticket has been submitted and requires attention.
            </Text>
          </Section>

          <Section style={styles.ticketInfo}>
            <Heading as="h3" style={styles.ticketSubject}>
              {ticket.subject}
            </Heading>

            <Text style={styles.meta}>
              <strong>Status:</strong> Open
            </Text>
            <Text style={styles.meta}>
              <strong>Department:</strong>{" "}
              {SUPPORT_TICKET_DEPARTMENT_LABELS[ticket.department]}
            </Text>
            <Text style={styles.meta}>
              <strong>Priority:</strong>{" "}
              {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
            </Text>
            {ticket.service && (
              <Text style={styles.meta}>
                <strong>Service:</strong> {ticket.service}
              </Text>
            )}
            {requesterName && (
              <Text style={styles.meta}>
                <strong>Requester:</strong> {requesterName}
              </Text>
            )}
            {requesterEmail && (
              <Text style={styles.meta}>
                <strong>Email:</strong> {requesterEmail}
              </Text>
            )}
          </Section>

          {ticket.description && (
            <Section style={styles.description}>
              <Text style={styles.descriptionLabel}>
                <strong>Description:</strong>
              </Text>
              <Text style={styles.descriptionText}>{ticket.description}</Text>
            </Section>
          )}

          <Hr style={styles.divider} />

          <Section style={styles.actions}>
            <Button href={ticketUrl} style={styles.button}>
              View & Respond to Ticket
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            You are receiving this because you are subscribed to support ticket
            notifications.
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
    color: "#dc2626",
    fontSize: "24px",
    fontWeight: "600" as const,
    margin: "0 0 24px 0",
  },
  alertBox: {
    backgroundColor: "#fef2f2",
    borderLeft: "4px solid #dc2626",
    borderRadius: "4px",
    padding: "12px 16px",
    marginBottom: "24px",
  },
  alertText: {
    color: "#991b1b",
    fontSize: "14px",
    margin: "0",
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
  description: {
    backgroundColor: "#f6f9fc",
    borderRadius: "6px",
    padding: "16px",
    marginBottom: "24px",
  },
  descriptionLabel: {
    color: "#1a1a1a",
    fontSize: "14px",
    margin: "0 0 8px 0",
  },
  descriptionText: {
    color: "#525f7f",
    fontSize: "14px",
    lineHeight: "20px",
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
    backgroundColor: "#dc2626",
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
