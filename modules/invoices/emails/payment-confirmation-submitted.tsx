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
} from "@react-email/components"

interface PaymentConfirmationSubmittedEmailProps {
  invoiceNumber: string
  amount: string
  bankName: string
  senderName?: string
  confirmationId: string
}

export const PaymentConfirmationSubmittedEmail = ({
  invoiceNumber,
  amount,
  bankName,
  senderName,
  confirmationId,
}: PaymentConfirmationSubmittedEmailProps) => (
  <Html>
    <Head />
    <Preview>Payment confirmation received for invoice {invoiceNumber}</Preview>
    <Body style={styles.body}>
      <Container style={styles.container}>
        <Heading style={styles.heading}>Payment Confirmation Submitted</Heading>
        <Text style={styles.intro}>
          A payment confirmation has been submitted and is awaiting review.
        </Text>
        <Section>
          <Text style={styles.detail}>
            <strong>Invoice:</strong> {invoiceNumber}
          </Text>
          <Text style={styles.detail}>
            <strong>Amount:</strong> {amount}
          </Text>
          <Text style={styles.detail}>
            <strong>Bank:</strong> {bankName}
          </Text>
          {senderName ? (
            <Text style={styles.detail}>
              <strong>Sender:</strong> {senderName}
            </Text>
          ) : null}
          <Text style={styles.detail}>
            <strong>Confirmation ID:</strong> {confirmationId}
          </Text>
        </Section>
        <Hr style={styles.divider} />
        <Text style={styles.footer}>
          Please review this payment confirmation in the billing portal.
        </Text>
      </Container>
    </Body>
  </Html>
)

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
