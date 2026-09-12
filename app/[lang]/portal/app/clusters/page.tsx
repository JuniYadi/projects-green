import type { Metadata } from "next"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { ClusterList } from "./_components/cluster-list"

export const metadata: Metadata = { title: "Cluster Inventory" }

export default async function ClusterListPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const locale = resolveLocaleOrDefault((await params).lang)
  const messages = getMessages(locale).console.app.clusterInventory

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{messages.heading}</h1>
        <p className="text-sm text-muted-foreground">{messages.description}</p>
      </header>

      <ClusterList />
    </main>
  )
}
