import type { Metadata } from "next"

import { getMessages } from "@/lib/i18n/messages"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"
import { WhatsAppInbox } from "@/modules/whatsapp/messages/ui/whatsapp-inbox"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const locale = resolveLocaleOrDefault((await params).lang)
  return { title: getMessages(locale).console.whatsapp.messages.heading }
}

export default function WhatsAppMessagesPage() {
  return <WhatsAppInbox />
}
