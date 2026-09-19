import type { Metadata } from "next"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { SshKeysTable } from "../_components/ssh-keys-table"

export const metadata: Metadata = { title: "SSH Keys" }

export default async function VpnSshKeysPage({
  params,
}: {
  params?: Promise<{ lang?: string }>
} = {}) {
  const resolvedParams = params ? await params : undefined
  const locale = resolveLocaleOrDefault(resolvedParams?.lang)
  const messages = getMessages(locale).pPortalPages.vpnSshKeys

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{messages.title}</h1>
        <p className="text-sm text-muted-foreground">
          {messages.description}
        </p>
      </header>
      <SshKeysTable />
    </main>
  )
}
