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
  billedToEmail,
  organizationName,
  locale = "en",
}: PaymentReminderEmailProps) => {
  const messages = getMessages(locale).pEmailTemplates.invoices
  const invoiceUrl = `${getEmailBaseUrl()}/console/invoices/${invoiceNumber}`

  return (
    <Html>
      <Head />
      <Preview>
        {messages.reminderPreview
          .replace("{invoiceNumber}", invoiceNumber)
          .replace("{dueAt}", dueAt)
          .replace("{amount}", amount)}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>{messages.reminderHeading}</Heading>

          <Text style={styles.intro}>
            {messages.reminderIntro
              .replace("{invoiceNumber}", invoiceNumber)
              .replace("{dueAt}", dueAt)}
          </Text>

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
            <Button href={invoiceUrl} style={styles.button}>
              {messages.reminderPayNow}
            </Button>
          </Section>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>{messages.createdFooter}</Text>
        </Container>
      </Body>
    </Html>
  )
}
