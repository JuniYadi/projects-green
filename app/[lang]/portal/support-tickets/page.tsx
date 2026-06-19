import { SupportTicketsPortal } from "@/app/[lang]/portal/support-tickets/support-tickets-portal"

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
        <h1 className="text-2xl font-semibold">Support Tickets (Admin)</h1>
        <p className="text-sm text-muted-foreground">
          Manage, prioritize, and reply to all support tickets across
          organizations.
        </p>
      </header>

      <SupportTicketsPortal lang={lang} />
    </main>
  )
}
