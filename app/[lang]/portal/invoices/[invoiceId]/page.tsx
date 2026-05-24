import Link from "next/link"

import { Button } from "@/components/ui/button"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { InvoiceDetailScreen } from "@/modules/invoices/ui/invoice-detail-screen"

type InvoiceDetailPageProps = {
  params: Promise<{
    lang: string
    invoiceId: string
  }>
}

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { lang, invoiceId } = await params
  const locale = resolveLocaleOrDefault(lang)

  const invoicesPath = localizePathname({
    pathname: "/portal/invoices",
    locale,
  })

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href={invoicesPath}>Back to Invoices</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Invoice Detail</h1>
        <p className="text-sm text-muted-foreground">
          Review invoice details, download PDF, and manage billing actions.
        </p>
      </header>

      <InvoiceDetailScreen invoiceId={invoiceId} lang={lang} />
    </main>
  )
}
