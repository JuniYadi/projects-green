import Link from "next/link"

import { Button } from "@/components/ui/button"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { SupportTicketAdminDetailScreen } from "@/app/[lang]/portal/support-tickets/support-ticket-admin-detail-screen"

type SupportTicketDetailPageProps = {
  params: Promise<{
    lang: string
    ticketId: string
  }>
}

export default async function SupportTicketDetailPage({
  params,
}: SupportTicketDetailPageProps) {
  const { lang, ticketId } = await params
  const locale = resolveLocaleOrDefault(lang)

  const listPath = localizePathname({
    pathname: "/portal/support-tickets",
    locale,
  })

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href={listPath}>Back to Support Tickets</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Support Ticket Details (Admin)</h1>
        <p className="text-sm text-muted-foreground">
          View full thread details, change categorization, reply, or delete the ticket.
        </p>
      </header>

      <SupportTicketAdminDetailScreen ticketId={ticketId} lang={lang} />
    </main>
  )
}
