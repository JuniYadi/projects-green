import Link from "next/link"

import { Button } from "@/components/ui/button"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { isInvoiceScreenScenario } from "@/modules/invoices/invoices.helpers"
import { getInvoiceListItemById } from "@/modules/invoices/invoices.mock"
import type { InvoiceScreenScenario } from "@/modules/invoices/invoices.types"
import { InvoiceDetailScreen } from "@/modules/invoices/ui/invoice-detail-screen"

type InvoiceDetailPageProps = {
  params: Promise<{
    lang: string
    invoiceId: string
  }>
  searchParams: Promise<{
    scenario?: string
  }>
}

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: InvoiceDetailPageProps) {
  const { lang, invoiceId } = await params
  const { scenario } = await searchParams
  const locale = resolveLocaleOrDefault(lang)

  const invoiceExists = getInvoiceListItemById(invoiceId) !== null

  const initialScenario: InvoiceScreenScenario =
    scenario && isInvoiceScreenScenario(scenario)
      ? scenario
      : invoiceExists
        ? "success"
        : "empty"

  const invoicesPath = localizePathname({
    pathname: "/console/invoices",
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
          Review invoice identity, line items, totals, and status using mocked
          module contracts.
        </p>
      </header>

      <InvoiceDetailScreen
        invoiceId={invoiceId}
        lang={lang}
        initialScenario={initialScenario}
      />
    </main>
  )
}
