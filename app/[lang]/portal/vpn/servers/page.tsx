import type { Metadata } from "next"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { ServersTable } from "../_components/servers-table"

export const metadata: Metadata = { title: "Servers" }

export default async function VpnServersPage({
  params,
}: {
  params?: Promise<{ lang?: string }>
} = {}) {
  const resolvedParams = params ? await params : undefined
  const locale = resolveLocaleOrDefault(resolvedParams?.lang)
  const messages = getMessages(locale).pPortalPages.vpnServers

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.description}
        </p>
      </header>
      <ServersTable />
    </main>
  )
}
