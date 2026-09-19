import type { Metadata } from "next"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import { InvoicesTable } from "@/app/[lang]/console/invoices/invoices-table"

export const metadata: Metadata = { title: "Invoices" }

type InvoicesPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function InvoicesPage({ params }: InvoicesPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pConsolePages.invoices

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.description}
        </p>
      </header>

      <section className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{messages.billingHistory}</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoicesTable lang={lang} />
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
