"use client"

import { useParams } from "next/navigation"
import {
  type WhatsAppStaticMessageId,
  whatsappStaticMessages,
} from "@/lib/i18n/messages/whatsapp-static"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

type WhatsAppTextProps = {
  id: WhatsAppStaticMessageId
  locale?: string
}

const resolveWhatsAppLocale = (locale?: string) => {
  if (locale) return resolveLocaleOrDefault(locale)

  return (
    typeof document !== "undefined" && document.documentElement.lang === "id"
      ? "id"
      : "en"
  )
}

export function getWhatsAppText(id: WhatsAppStaticMessageId, locale?: string) {
  return whatsappStaticMessages[resolveWhatsAppLocale(locale)][id]
}

export function formatWhatsAppText(
  id: WhatsAppStaticMessageId,
  values: Record<string, number | string>,
  locale?: string
) {
  return getWhatsAppText(id, locale).replace(
    /\{(\w+)\}/g,
    (_, key: string) => String(values[key] ?? `{${key}}`)
  )
}

export function WhatsAppText({ id, locale: suppliedLocale }: WhatsAppTextProps) {
  const params = useParams<{ lang?: string }>()
  const locale = suppliedLocale ?? params?.lang

  return getWhatsAppText(id, locale)
}
