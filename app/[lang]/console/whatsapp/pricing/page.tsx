import type { Metadata } from "next"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const locale = resolveLocaleOrDefault((await params).lang)
  return { title: getMessages(locale).console.whatsapp.pricing.heading }
}

export { default } from "./page-client"
