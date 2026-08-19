import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

import type { Metadata } from "next"

import { BillingDashboard } from "@/app/[lang]/console/billing/billing-dashboard"

type BillingPageProps = {
  params: Promise<{
    lang: string
  }>
}

export const metadata: Metadata = {
  title: "Billing | Console",
  description: "Manage your billing, subscriptions, and invoices.",
}

export default async function BillingPage({ params }: BillingPageProps) {
  const { lang } = await params
  const locale = resolveLocaleOrDefault(lang)
  const messages = getMessages(locale)
  return (
    <main className="flex flex-1 flex-col gap-6 p-6 pt-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {messages.console.billing.heading}
        </h1>
        <p className="text-sm text-muted-foreground">
          {messages.console.billing.description}
        </p>
      </header>

      <BillingDashboard />
    </main>
  )
}
