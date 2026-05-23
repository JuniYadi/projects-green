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

interface InvoiceOverdueEmailProps {
  invoiceNumber: string
  amount: string
  currency: string
  status: string
  issuedAt: string
  dueAt: string
  periodStart: string
  periodEnd: string
}

export const InvoiceOverdueEmail = ({
  invoiceNumber,
  amount,
  dueAt,
}: InvoiceOverdueEmailProps) => {
  const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3300"}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        OVERDUE: Invoice {invoiceNumber} Payment Required
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            Invoice Overdue
          </Heading>

          <Text style={styles.intro}>
            Invoice {invoiceNumber} is now overdue. Please make payment immediately to avoid service interruption or additional fees.
          </Text>

          <Section style={styles.invoiceInfo}>
            <Heading as="h3" style={styles.invoiceNumber}>
              {invoiceNumber}
            </Heading>

            <Text style={styles.amount}>{amount}</Text>

            <Text style={styles.meta}>
              <strong>Due Date:</strong> {dueAt}
            </Text>
          </Section>

          <Hr style={styles.divider} />

          <Section style={styles.actions}>
            <Button href={invoiceUrl} style={styles.button}>
              Pay Now
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            If you believe this is an error or need to discuss payment arrangements, please contact us immediately.
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
    color: "#dc3545",
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
    backgroundColor: "#ffe6e6",
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
    backgroundColor: "#dc3545",
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