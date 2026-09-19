import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email"
import { getMessages } from "@/lib/i18n/messages"
import type { AppLocale } from "@/lib/i18n/config"

interface PaymentConfirmationSubmittedEmailProps {
  invoiceNumber: string
  amount: string
  bankName: string
  senderName?: string
  confirmationId: string
  locale?: AppLocale
}

export const PaymentConfirmationSubmittedEmail = ({
  invoiceNumber,
  amount,
  bankName,
  senderName,
  confirmationId,
  locale = "en",
}: PaymentConfirmationSubmittedEmailProps) => {
  const messages = getMessages(locale).pEmailTemplates.invoices

  return (
    <Html>
      <Head />
      <Preview>{messages.confirmationPreview.replace("{invoiceNumber}", invoiceNumber)}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{messages.confirmationHeading}</Heading>
          <Text style={styles.intro}>
            {messages.confirmationIntro.replace("{invoiceNumber}", invoiceNumber)}
          </Text>
          <Section>
            <Text style={styles.detail}>
              <strong>{messages.invoiceNumber}</strong> {invoiceNumber}
            </Text>
            <Text style={styles.detail}>
              <strong>{messages.totalAmount}:</strong> {amount}
            </Text>
            <Text style={styles.detail}>
              <strong>{messages.paymentMethod}</strong> {bankName}
            </Text>
            {senderName ? (
              <Text style={styles.detail}>
                <strong>{messages.billedTo}</strong> {senderName}
              </Text>
            ) : null}
            <Text style={styles.detail}>
              <strong>{messages.confirmationViewStatus}:</strong> {confirmationId}
            </Text>
          </Section>
          <Hr style={styles.divider} />
          <Text style={styles.footer}>
            {messages.automatedNotice}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    padding: "32px",
    maxWidth: "560px",
  },
  heading: {
    color: "#111827",
    fontSize: "24px",
    fontWeight: "700",
    margin: "0 0 16px",
  },
  intro: {
    color: "#374151",
    fontSize: "16px",
    lineHeight: "24px",
  },
  detail: {
    color: "#374151",
    fontSize: "15px",
    lineHeight: "22px",
    margin: "8px 0",
  },
  divider: {
    borderColor: "#e5e7eb",
    margin: "24px 0",
  },
  footer: {
    color: "#6b7280",
    fontSize: "14px",
    lineHeight: "20px",
  },
}
