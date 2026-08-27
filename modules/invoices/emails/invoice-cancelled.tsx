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
import type { InvoiceCancelledEmailProps } from "./types"
import {
  InvoiceCostBreakdown,
  InvoiceItemsList,
  InvoiceSummarySection,
  styles,
} from "./invoice-components"

export const InvoiceCancelledEmail = ({
  invoiceNumber,
  amount,
  status = "Canceled",
  issuedAt,
  dueAt,
  periodStart,
  periodEnd,
  reason,
  subtotalAmount,
  taxAmount,
  discountAmount,
  lineItems,
  recipientEmail,
  organizationName,
}: InvoiceCancelledEmailProps) => {
  const invoiceUrl = `${getEmailBaseUrl()}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        Notice: Invoice {invoiceNumber} Has Been Cancelled ({amount})
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Invoice Cancelled</Heading>

          <Text style={styles.intro}>
            Invoice {invoiceNumber} has been officially cancelled. No payment is
            required for this invoice, and no further action is needed from you.
          </Text>

          {reason && (
            <Section style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                <strong>Cancellation Reason:</strong> {reason}
              </Text>
            </Section>
          )}

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
            totalLabel="Cancelled Amount"
          />

          <Section style={styles.actions}>
            <Button
              href={invoiceUrl}
              style={{ ...styles.button, backgroundColor: "#64748b" }}
            >
              View Invoice Details
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            If you have questions regarding this cancellation or need a revised
            invoice, please reach out to our billing team.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
