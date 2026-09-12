import type { Metadata } from "next"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const locale = resolveLocaleOrDefault((await params).lang)
  const billing = getMessages(locale).console.billing
  return { title: billing.subscriptions.heading }
}

export { default } from "./page-client"
