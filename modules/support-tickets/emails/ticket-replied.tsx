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
import { getEmailBaseUrl } from "@/lib/email-url"
import type { SupportTicket, SupportTicketReply } from "../support-ticket.types"
import { SUPPORT_TICKET_STATUS_LABELS } from "../support-ticket.types"

interface TicketRepliedEmailProps {
  ticket: SupportTicket
  reply: SupportTicketReply
  replyContext?: {
    authorName: string
    authorRole: "Requester" | "Support Admin"
    hasSecureDetails: boolean
    repliedAt: Date
  }
}

export const TicketRepliedEmail = ({
  ticket,
  reply,
  replyContext,
}: TicketRepliedEmailProps) => {
  const ticketUrl = `${getEmailBaseUrl()}/console/support-tickets/${ticket.id}`

  const formattedRepliedAt = replyContext
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(replyContext.repliedAt)
    : null

  return (
    <Html>
      <Head />
      <Preview>
        Re: Support ticket #{ticket.ticketNumber} - {ticket.subject}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Re: {ticket.subject}</Heading>

          {replyContext ? (
            <Text style={styles.intro}>
              Replied by {replyContext.authorName} ({replyContext.authorRole}) ·{" "}
              {formattedRepliedAt}
            </Text>
          ) : (
            <Text style={styles.intro}>
              A member of our support team has replied to your ticket.
            </Text>
          )}

          <Section style={styles.ticketInfo}>
            <Heading as="h3" style={styles.ticketSubject}>
              {ticket.subject}
            </Heading>

            <Text style={styles.meta}>
              <strong>Status:</strong>{" "}
              {SUPPORT_TICKET_STATUS_LABELS[ticket.status]}
            </Text>
          </Section>

          <Section style={styles.replyPreview}>
            <Text style={styles.replyBody}>{reply.body}</Text>
            {replyContext?.hasSecureDetails && (
              <Text style={styles.replyBody}>
                Secure details attached (encrypted). Open the ticket to view.
              </Text>
            )}
          </Section>

          <Hr style={styles.divider} />

          <Section style={styles.actions}>
            <Button href={ticketUrl} style={styles.button}>
              View Full Conversation
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            You can reply directly to this email to add more information to your
            ticket.
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
    backgroundColor: "#f6f9fc",
    borderRadius: "6px",
    padding: "16px",
    marginBottom: "24px",
  },
  replyLabel: {
    color: "#1a1a1a",
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0 0 8px 0",
  },
  replyBody: {
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
    backgroundColor: "#3b82f6",
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
