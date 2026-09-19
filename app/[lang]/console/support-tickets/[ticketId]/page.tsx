import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/messages"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { SupportTicketDetailScreen } from "@/app/[lang]/console/support-tickets/support-ticket-detail-screen"

export const metadata: Metadata = { title: "Support Ticket Detail" }

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
  const messages = getMessages(locale).pConsolePages.supportTicketsDetail

  const listPath = localizePathname({
    pathname: "/console/support-tickets",
    locale,
  })

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href={listPath}>{messages.backLink}</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.description}
        </p>
      </header>

      <SupportTicketDetailScreen ticketId={ticketId} />
    </main>
  )
}
