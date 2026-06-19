import { defaultLocale, type AppLocale } from "@/lib/i18n/config"
import { enMessages } from "@/lib/i18n/messages/en"
import { idMessages } from "@/lib/i18n/messages/id"

import type { AppMessages } from "@/lib/i18n/messages/types"

const messagesByLocale: Record<AppLocale, AppMessages> = {
  en: enMessages,
  id: idMessages,
}

export const getMessages = (locale: AppLocale) => {
  return messagesByLocale[locale]
}

export const getMessagesForMaybeLocale = (
  locale: string | null | undefined
) => {
  if (locale && locale in messagesByLocale) {
    return messagesByLocale[locale as AppLocale]
  }

  return messagesByLocale[defaultLocale]
}
