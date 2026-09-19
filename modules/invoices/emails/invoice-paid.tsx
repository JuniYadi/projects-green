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
import { getMessages } from "@/lib/i18n/messages"
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
  locale = "en",
}: InvoicePaidEmailProps) => {
  const messages = getMessages(locale).pEmailTemplates.invoices
  const invoiceUrl = `${getEmailBaseUrl()}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        {messages.paidPreview
          .replace("{invoiceNumber}", invoiceNumber)
          .replace("{amount}", amount)}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{messages.paidHeading}</Heading>

          <Text style={styles.intro}>
            {messages.paidIntro.replace("{invoiceNumber}", invoiceNumber)}
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
            locale={locale}
          />

          <InvoiceItemsList lineItems={lineItems} locale={locale} />

          <InvoiceCostBreakdown
            amount={amount}
            subtotalAmount={subtotalAmount}
            taxAmount={taxAmount}
            discountAmount={discountAmount}
            totalLabel={messages.totalAmount}
            locale={locale}
          />

          <Section style={styles.actions}>
            <Button href={invoiceUrl} style={styles.button}>
              {messages.paidViewReceipt}
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            {messages.paidFooter}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
