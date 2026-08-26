import type { Metadata } from "next"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import { BillingContactsList } from "./billing-contacts-list"
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const locale = resolveLocaleOrDefault((await params).lang)
  const t = getMessages(locale).console.billing.contacts
  return { title: `${t.heading} | Console`, description: t.description }
}

export default async function BillingContactsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const locale = resolveLocaleOrDefault((await params).lang)
  const t = getMessages(locale).console.billing.contacts

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.heading}</h1>
        <p className="text-sm text-muted-foreground">{t.description}</p>
      </header>

      <BillingContactsList />
    </main>
  )
}
