"use client"

import { useParams } from "next/navigation"
import {
  type WhatsAppStaticMessageId,
  whatsappStaticMessages,
} from "@/lib/i18n/messages/whatsapp-static"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type WhatsAppTextProps = {
  id: WhatsAppStaticMessageId
}

export function getWhatsAppText(id: WhatsAppStaticMessageId) {
  const locale =
    typeof document !== "undefined" && document.documentElement.lang === "id"
      ? "id"
      : "en"

  return whatsappStaticMessages[locale][id]
}

export function WhatsAppText({ id }: WhatsAppTextProps) {
  const params = useParams<{ lang?: string }>()
  const locale = resolveLocaleOrDefault(params?.lang)

  return whatsappStaticMessages[locale][id]
}
