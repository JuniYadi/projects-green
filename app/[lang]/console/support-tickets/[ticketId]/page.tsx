import Link from "next/link"

import { Button } from "@/components/ui/button"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { SupportTicketDetailScreen } from "@/app/[lang]/console/support-tickets/support-ticket-detail-screen"

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
    pathname: "/console/support-tickets",
    locale,
  })

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href={listPath}>Back to Support Tickets</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Support Ticket Detail</h1>
        <p className="text-sm text-muted-foreground">
          Review thread history, reply, upload attachments, and close the ticket.
        </p>
      </header>

      <SupportTicketDetailScreen ticketId={ticketId} />
    </main>
  )
}
