import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { SupportTicketsTable } from "@/app/[lang]/console/support-tickets/support-tickets-table"

type SupportTicketsPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function SupportTicketsPage({
  params,
}: SupportTicketsPageProps) {
  await params

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Track current support requests and follow up on pending issues.
        </p>
      </header>

      <section className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ticket Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <SupportTicketsTable />
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
