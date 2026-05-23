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

interface InvoiceCreatedEmailProps {
  invoiceNumber: string
  amount: string
  currency: string
  status: string
  issuedAt: string
  dueAt: string
  periodStart: string
  periodEnd: string
}

export const InvoiceCreatedEmail = ({
  invoiceNumber,
  amount,
  dueAt,
}: InvoiceCreatedEmailProps) => {
  const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3300"}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        Invoice {invoiceNumber} - Payment Due {dueAt}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>
            Invoice {invoiceNumber}
          </Heading>

          <Text style={styles.intro}>
            A new invoice has been created for your account. Please review the details below and process payment by the due date.
          </Text>

          <Section style={styles.invoiceInfo}>
            <Heading as="h3" style={styles.invoiceNumber}>
              {invoiceNumber}
            </Heading>

            <Text style={styles.amount}>{amount}</Text>

            <Text style={styles.meta}>
              <strong>Due Date:</strong> {dueAt}
            </Text>
            <Text style={styles.meta}>
              <strong>Status:</strong> {status}
            </Text>
          </Section>

          <Hr style={styles.divider} />

          <Section style={styles.actions}>
            <Button href={invoiceUrl} style={styles.button}>
              View Invoice
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            If you have any questions about this invoice, please contact our billing team.
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
  invoiceInfo: {
    backgroundColor: "#f6f9fc",
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