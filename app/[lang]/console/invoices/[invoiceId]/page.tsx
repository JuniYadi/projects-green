import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { InvoiceDetailScreen } from "@/modules/invoices/ui/invoice-detail-screen"

export const metadata: Metadata = { title: "Invoice Detail" }

type InvoiceDetailPageProps = {
  params: Promise<{
    lang: string
    invoiceId: string
  }>
}

export default async function InvoiceDetailPage({
  params,
}: InvoiceDetailPageProps) {
  const { lang, invoiceId } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pConsolePages.invoiceDetail

  const invoicesPath = localizePathname({
    pathname: "/console/invoices",
    locale,
  })

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href={invoicesPath}>{messages.backLink}</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.description}
        </p>
      </header>

      <InvoiceDetailScreen invoiceId={invoiceId} lang={lang} />
    </main>
  )
}
