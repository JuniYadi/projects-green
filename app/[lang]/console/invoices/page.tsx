import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { InvoicesTable } from "@/app/[lang]/console/invoices/invoices-table"

type InvoicesPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function InvoicesPage({ params }: InvoicesPageProps) {
  await params

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Review recent billing records for your active organization.
        </p>
      </header>

      <section className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Billing History</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoicesTable />
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
