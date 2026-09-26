import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Text,
  render,
} from "react-email"

import { getEmailBaseUrl } from "@/lib/email-url"
import { getPlatformAdminEmails } from "@/lib/platform-admin-emails"
import { sendEmail } from "@/lib/queue/email"

export type BillingNoticeEvent =
  "order_placed" | "confirmation_submitted" | "topup_paid"

type BillingNotice = {
  organizationName: string
  actorEmail?: string | null
  amount: number
  currency: string
  reference: string
  occurredAt: Date
  path: string
}

const labels = {
  order_placed: { en: "New order", id: "Pesanan baru" },
  confirmation_submitted: {
    en: "Payment confirmation needs review",
    id: "Konfirmasi pembayaran perlu ditinjau",
  },
  topup_paid: { en: "Top-up received", id: "Top-up diterima" },
} as const

export function BillingNoticeEmail({
  title,
  notice,
  locale = "en",
}: {
  title: string
  notice: BillingNotice
  locale?: "id" | "en"
}) {
  const id = locale === "id"
  const amount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: notice.currency,
  }).format(notice.amount)
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>{title}</Heading>
          <Text>
            {id ? "Organisasi" : "Organization"}: {notice.organizationName}
          </Text>
          <Text>
            {id ? "Dilakukan oleh" : "Actor"}: {notice.actorEmail ?? "—"}
          </Text>
          <Text>
            {id ? "Jumlah" : "Amount"}: {amount}
          </Text>
          <Text>
            {id ? "Referensi" : "Reference"}: {notice.reference}
          </Text>
          <Text>
            {id ? "Waktu" : "Time"}: {notice.occurredAt.toISOString()}
          </Text>
          <Button href={`${getEmailBaseUrl()}${notice.path}`}>
            {id ? "Lihat di portal" : "View in portal"}
          </Button>
        </Container>
      </Body>
    </Html>
  )
}

export async function notifySuperAdmins(
  event: BillingNoticeEvent,
  notice: BillingNotice
): Promise<void> {
  const emails = await getPlatformAdminEmails()
  if (emails.length === 0) {
    console.warn(`[BillingNotice] No platform users for ${event}`)
    return
  }
  const subject = labels[event].en
  const html = await render(
    <BillingNoticeEmail title={subject} notice={notice} />
  )
  await Promise.all(
    emails.map((to) =>
      sendEmail({ to, subject, html }).catch((error) => {
        console.error(`[BillingNotice] Failed ${event} to ${to}:`, error)
      })
    )
  )
}

export function CustomerPaymentDecisionEmail({
  approved,
  invoiceNumber,
  reason,
  locale = "en",
}: {
  approved: boolean
  invoiceNumber: string
  reason?: string
  locale?: "id" | "en"
}) {
  const id = locale === "id"
  const title = approved
    ? id
      ? "Pembayaran disetujui"
      : "Payment approved"
    : id
      ? "Pembayaran ditolak"
      : "Payment rejected"
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>{title}</Heading>
          <Text>Invoice: {invoiceNumber}</Text>
          {!approved && (
            <Text>
              {id ? "Alasan" : "Reason"}: {reason}
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  )
}

export async function sendCustomerPaymentDecision(
  to: string,
  invoiceNumber: string,
  approved: boolean,
  reason?: string
): Promise<void> {
  const subject = approved ? "Payment approved" : "Payment rejected"
  const html = await render(
    <CustomerPaymentDecisionEmail
      approved={approved}
      invoiceNumber={invoiceNumber}
      reason={reason}
    />
  )
  await sendEmail({ to, subject, html })
}
