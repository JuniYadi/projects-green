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
import type { PaymentReminderEmailProps } from "./types"
import {
  InvoiceCostBreakdown,
  InvoiceItemsList,
  InvoiceSummarySection,
  styles,
} from "./invoice-components"

export const PaymentReminderEmail = ({
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
}: PaymentReminderEmailProps) => {
  const invoiceUrl = `${getEmailBaseUrl()}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        Payment Reminder: Invoice {invoiceNumber} is due on {dueAt} ({amount})
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Payment Reminder</Heading>

          <Text style={styles.intro}>
            This is a friendly reminder that Invoice {invoiceNumber} is due for
            payment on <strong>{dueAt}</strong>. Please ensure timely payment to
            avoid any service interruption.
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
            totalLabel="Amount Due"
          />

          <Section style={styles.actions}>
            <Button href={invoiceUrl} style={styles.button}>
              Pay Invoice Now
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            If you have already processed this payment, please disregard this
            reminder.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
