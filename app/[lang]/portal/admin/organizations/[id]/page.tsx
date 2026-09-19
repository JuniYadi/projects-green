import type { Metadata } from "next"

import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/ui/phosphor-icons"
import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import Link from "next/link"
import { MembersTable } from "./members-table"

export const metadata: Metadata = { title: "Organization Details" }

export default async function OrganizationDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string; lang?: string }>
}>) {
  const { id, lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale).pPortalPages.adminOrganizations

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <div className="flex items-center gap-4">
          <Link href="/portal/admin/organizations">
            <Button variant="ghost" size="icon">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{messages.detailsTitle}</h1>
            <p className="font-mono text-sm text-muted-foreground">{id}</p>
          </div>
        </div>
      </header>
      <MembersTable organizationId={id} />
    </main>
  )
}
