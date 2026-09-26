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
  billedToEmail,
  organizationName,
  locale = "en",
}: InvoiceCancelledEmailProps) => {
  const messages = getMessages(locale).pEmailTemplates.invoices
  const invoiceUrl = `${getEmailBaseUrl()}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        {messages.cancelledPreview
          .replace("{invoiceNumber}", invoiceNumber)
          .replace("{amount}", amount)}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{messages.cancelledHeading}</Heading>

          <Text style={styles.intro}>
            {messages.cancelledIntro.replace("{invoiceNumber}", invoiceNumber)}
          </Text>

          {reason && (
            <Section style={styles.noticeBox}>
              <Text style={styles.noticeText}>
                <strong>{messages.cancelledReason}</strong> {reason}
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
            billedToEmail={billedToEmail}
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
            <Button
              href={invoiceUrl}
              style={{ ...styles.button, backgroundColor: "#64748b" }}
            >
              {messages.cancelledView}
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>{messages.createdFooter}</Text>
        </Container>
      </Body>
    </Html>
  )
}
