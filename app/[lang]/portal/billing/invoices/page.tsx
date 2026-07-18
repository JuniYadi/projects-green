import { InvoicesTable } from "@/app/[lang]/portal/invoices/invoices-table"

export default async function BillingInvoicesPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">
          Review billing records, download receipts, and manage invoice status.
        </p>
      </header>

      <InvoicesTable lang={lang} />
    </main>
  )
}
