import Link from "next/link"

import { Button } from "@/components/ui/button"
import { localizePathname, resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { SupportTicketAdminCreateScreen } from "@/app/[lang]/portal/support-tickets/support-ticket-admin-create-screen"

type SupportTicketCreatePageProps = {
  params: Promise<{
    lang: string
  }>
}

export default async function SupportTicketCreatePage({
  params,
}: SupportTicketCreatePageProps) {
  const { lang } = await params
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
        <h1 className="text-2xl font-semibold">Create Support Ticket (Admin)</h1>
        <p className="text-sm text-muted-foreground">
          Open a ticket on behalf of an organization with optional secure credentials and attachments.
        </p>
      </header>

      <SupportTicketAdminCreateScreen lang={lang} />
    </main>
  )
}
