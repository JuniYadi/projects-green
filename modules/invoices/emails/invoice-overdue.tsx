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
} from "react-email"
import { getEmailBaseUrl } from "@/lib/email-url"
import type { InvoiceOverdueEmailProps } from "./types"
import {
  InvoiceCostBreakdown,
  InvoiceItemsList,
  InvoiceSummarySection,
  styles,
} from "./invoice-components"

export const InvoiceOverdueEmail = ({
  invoiceNumber,
  amount,
  dueAt,
  status = "Overdue",
  issuedAt,
  periodStart,
  periodEnd,
  subtotalAmount,
  taxAmount,
  discountAmount,
  lineItems,
  recipientEmail,
  organizationName,
}: InvoiceOverdueEmailProps) => {
  const invoiceUrl = `${getEmailBaseUrl()}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        ACTION REQUIRED: Invoice {invoiceNumber} is Overdue ({amount})
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Invoice Overdue</Heading>

          <Text style={styles.intro}>
            Your payment for Invoice {invoiceNumber} was due on{" "}
            <strong>{dueAt}</strong> and is now overdue. Please settle this
            invoice immediately to prevent any potential service suspension.
          </Text>

          <Section style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              <strong>Urgent:</strong> Outstanding balance of{" "}
              <strong>{amount}</strong> must be paid to maintain uninterrupted
              services.
            </Text>
          </Section>

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
            totalLabel="Overdue Balance"
          />

          <Section style={styles.actions}>
            <Button
              href={invoiceUrl}
              style={{ ...styles.button, backgroundColor: "#dc2626" }}
            >
              Pay Overdue Balance Now
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            If you have recently made this payment, please contact our support
            team with proof of payment to expedite account review.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
