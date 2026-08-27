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
import type { InvoiceCreatedEmailProps } from "./types"
import {
  InvoiceCostBreakdown,
  InvoiceItemsList,
  InvoiceSummarySection,
  styles,
} from "./invoice-components"

export const InvoiceCreatedEmail = ({
  invoiceNumber,
  amount,
  dueAt,
  status,
  issuedAt,
  periodStart,
  periodEnd,
  subtotalAmount,
  taxAmount,
  discountAmount,
  lineItems,
  recipientEmail,
  organizationName,
}: InvoiceCreatedEmailProps) => {
  const invoiceUrl = `${getEmailBaseUrl()}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        Invoice {invoiceNumber} - Payment Due {dueAt} ({amount})
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Invoice {invoiceNumber}</Heading>

          <Text style={styles.intro}>
            A new invoice has been issued for your account. Please review the
            breakdown and complete payment by the due date.
          </Text>

          <InvoiceSummarySection
            invoiceNumber={invoiceNumber}
            status={status}
            issuedAt={issuedAt}
            dueAt={dueAt}
            periodStart={periodStart}
            periodEnd={periodEnd}
            recipientEmail={recipientEmail}
            organizationName={organizationName}
          />

          <InvoiceItemsList lineItems={lineItems} />

          <InvoiceCostBreakdown
            amount={amount}
            subtotalAmount={subtotalAmount}
            taxAmount={taxAmount}
            discountAmount={discountAmount}
            totalLabel="Total Due"
          />

          <Section style={styles.actions}>
            <Button href={invoiceUrl} style={styles.button}>
              View &amp; Pay Invoice
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            If you have any questions or need billing assistance, please reach
            out to our support team.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
