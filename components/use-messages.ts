"use client"

import { useParams } from "next/navigation"

import { getMessages } from "@/lib/i18n/messages"
import type { AppMessages } from "@/lib/i18n/messages/types"
import { resolveLocaleOrDefault } from "@/lib/i18n/pathname"

/**
 * Resolve the message dictionary for a shared client component.
 *
 * Components rendered inside a localized route (`/[lang]/...`) resolve the
 * locale from the route params, while an explicit `lang` prop always wins so
 * callers that already thread the locale through keep working. Falls back to
 * the default locale when neither is available (e.g. unit tests).
 */
export function useMessages(lang?: string): AppMessages {
  const params = useParams<{ lang?: string }>()

  return getMessages(resolveLocaleOrDefault(lang ?? params?.lang))
}
