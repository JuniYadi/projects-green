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
  billedToEmail,
  organizationName,
  locale = "en",
}: InvoiceOverdueEmailProps) => {
  const messages = getMessages(locale).pEmailTemplates.invoices
  const invoiceUrl = `${getEmailBaseUrl()}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        {messages.overduePreview
          .replace("{invoiceNumber}", invoiceNumber)
          .replace("{amount}", amount)}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{messages.overdueHeading}</Heading>

          <Text style={styles.intro}>
            {messages.overdueIntro.replace("{invoiceNumber}", invoiceNumber)}
          </Text>

          <Section style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              <strong>{messages.overdueGraceNotice}</strong>
            </Text>
          </Section>

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
              style={{ ...styles.button, backgroundColor: "#dc2626" }}
            >
              {messages.overduePayNow}
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>{messages.createdFooter}</Text>
        </Container>
      </Body>
    </Html>
  )
}
