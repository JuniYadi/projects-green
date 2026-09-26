import { Body, Button, Container, Head, Heading, Html, Text } from "react-email"
import { getEmailBaseUrl } from "@/lib/email-url"
import type { AppLocale } from "@/lib/i18n/config"

export function TopupReceivedAdminNotice({
  invoiceId,
  organizationName,
  actorEmail,
  amount,
  paymentMethod,
  paidAt,
  locale = "en",
}: {
  invoiceId: string
  organizationName: string
  actorEmail: string | null
  amount: string
  paymentMethod: string | null
  paidAt: string
  locale?: AppLocale
}) {
  const indonesian = locale === "id"
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>
            {indonesian ? "Top-up diterima" : "Top-up received"}
          </Heading>
          <Text>
            {indonesian ? "Organisasi" : "Organization"}: {organizationName}
          </Text>
          <Text>
            {indonesian ? "Dilakukan oleh" : "Topped up by"}:{" "}
            {actorEmail ?? (indonesian ? "Tidak diketahui" : "Unknown")}
          </Text>
          <Text>
            {indonesian ? "Jumlah" : "Amount"}: {amount}
          </Text>
          <Text>
            {indonesian ? "Metode pembayaran" : "Payment method"}:{" "}
            {paymentMethod ?? "—"}
          </Text>
          <Text>
            {indonesian ? "Dibayar pada" : "Paid at"}: {paidAt}
          </Text>
          <Button
            href={`${getEmailBaseUrl()}/console/billing/invoices/${invoiceId}`}
          >
            {indonesian ? "Lihat invoice" : "View invoice"}
          </Button>
        </Container>
      </Body>
    </Html>
  )
}
