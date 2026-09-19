import type { Metadata } from "next"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { InvoicesTable } from "@/app/[lang]/portal/invoices/invoices-table"

export const metadata: Metadata = { title: "Invoices" }

export default async function BillingInvoicesPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pPortalPages.billingInvoices

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">{messages.title}</h1>
        <p className="text-muted-foreground">
          {messages.description}
        </p>
      </header>

      <InvoicesTable lang={lang} />
    </main>
  )
}
