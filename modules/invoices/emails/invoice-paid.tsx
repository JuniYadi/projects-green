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

interface InvoicePaidEmailProps {
  invoiceNumber: string
  amount: string
  currency: string
  status: string
  issuedAt: string
  dueAt: string
  periodStart: string
  periodEnd: string
}

export const InvoicePaidEmail = ({
  invoiceNumber,
  amount,
}: InvoicePaidEmailProps) => {
  const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3300"}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>Payment Received - Invoice {invoiceNumber}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Payment Confirmed</Heading>

          <Text style={styles.intro}>
            Thank you! We have received your payment for Invoice {invoiceNumber}
            . Your account is in good standing.
          </Text>

          <Section style={styles.invoiceInfo}>
            <Heading as="h3" style={styles.invoiceNumber}>
              {invoiceNumber}
            </Heading>

            <Text style={styles.amount}>{amount}</Text>

            <Text style={styles.statusBadge}>PAID</Text>
          </Section>

          <Hr style={styles.divider} />

          <Section style={styles.actions}>
            <Button href={invoiceUrl} style={styles.button}>
              View Receipt
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            Thank you for your business. If you have any questions, please
            contact our billing team.
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
    color: "#28a745",
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
  invoiceInfo: {
    backgroundColor: "#e8f5e9",
    borderRadius: "6px",
    padding: "24px",
    margin: "0 0 24px 0",
  },
  invoiceNumber: {
    color: "#1a1a1a",
    fontSize: "20px",
    fontWeight: "600" as const,
    margin: "0 0 16px 0",
  },
  amount: {
    color: "#1a1a1a",
    fontSize: "32px",
    fontWeight: "700" as const,
    margin: "0 0 16px 0",
  },
  statusBadge: {
    backgroundColor: "#28a745",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "600" as const,
    padding: "4px 12px",
    borderRadius: "4px",
    display: "inline-block",
    margin: "0",
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
    backgroundColor: "#28a745",
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
