import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import type { Metadata } from "next"

import { BillingAlertsForm } from "./billing-alerts-form"

export const metadata: Metadata = {
  title: "Billing Alerts | Console",
  description: "Configure billing alert preferences",
}

export default async function BillingAlertsPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const messages = getMessages(resolveLocaleOrDefault(lang))
  const page = messages.console.billing.alertsPage
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{page.heading}</h1>
        <p className="text-sm text-muted-foreground">{page.description}</p>
      </header>

      <BillingAlertsForm />
    </main>
  )
}
