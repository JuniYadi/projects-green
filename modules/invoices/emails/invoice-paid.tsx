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
import type { InvoicePaidEmailProps } from "./types"
import {
  InvoiceCostBreakdown,
  InvoiceItemsList,
  InvoiceSummarySection,
  styles,
} from "./invoice-components"

export const InvoicePaidEmail = ({
  invoiceNumber,
  amount,
  status = "Paid",
  issuedAt,
  dueAt,
  periodStart,
  periodEnd,
  paidAt,
  paymentMethod,
  subtotalAmount,
  taxAmount,
  discountAmount,
  lineItems,
  recipientEmail,
  organizationName,
}: InvoicePaidEmailProps) => {
  const invoiceUrl = `${getEmailBaseUrl()}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        Payment Receipt - Invoice {invoiceNumber} ({amount})
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Payment Receipt</Heading>

          <Text style={styles.intro}>
            Thank you! We have successfully received and confirmed your payment
            for Invoice {invoiceNumber}. Your account is active and in good
            standing.
          </Text>

          <InvoiceSummarySection
            invoiceNumber={invoiceNumber}
            status={status}
            issuedAt={issuedAt}
            dueAt={dueAt}
            periodStart={periodStart}
            periodEnd={periodEnd}
            paidAt={paidAt}
            paymentMethod={paymentMethod}
            recipientEmail={recipientEmail}
            organizationName={organizationName}
          />

          <InvoiceItemsList lineItems={lineItems} />

          <InvoiceCostBreakdown
            amount={amount}
            subtotalAmount={subtotalAmount}
            taxAmount={taxAmount}
            discountAmount={discountAmount}
            totalLabel="Total Paid"
          />

          <Section style={styles.actions}>
            <Button href={invoiceUrl} style={styles.button}>
              View Receipt in Console
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            Thank you for choosing our services. If you need any assistance,
            feel free to reply or contact support.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
