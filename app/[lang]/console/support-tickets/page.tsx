import { SupportTicketsConsole } from "@/app/[lang]/console/support-tickets/support-tickets-console"

type SupportTicketsPageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function SupportTicketsPage({
  params,
}: SupportTicketsPageProps) {
  const { lang } = await params

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground">
          Track current support requests and follow up on pending issues.
        </p>
      </header>

      <SupportTicketsConsole lang={lang} />
    </main>
  )
}
