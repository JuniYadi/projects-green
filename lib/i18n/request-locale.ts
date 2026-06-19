import { match as matchLocale } from "@formatjs/intl-localematcher"
import Negotiator from "negotiator"

import { defaultLocale, locales, type AppLocale } from "@/lib/i18n/config"
import { isLocale } from "@/lib/i18n/pathname"

const resolveFromHeader = (acceptLanguageHeader: string | undefined) => {
  if (!acceptLanguageHeader) {
    return defaultLocale
  }

  const requestedLocales = new Negotiator({
    headers: {
      "accept-language": acceptLanguageHeader,
    },
  })
    .languages()
    .filter((language) => language !== "*")

  if (requestedLocales.length === 0) {
    return defaultLocale
  }

  try {
    return matchLocale(requestedLocales, locales, defaultLocale)
  } catch {
    return defaultLocale
  }
}

export const resolveRequestLocale = ({
  acceptLanguageHeader,
  cookieLocale,
}: {
  acceptLanguageHeader: string | undefined
  cookieLocale: string | undefined
}): AppLocale => {
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale
  }

  const matchedLocale = resolveFromHeader(acceptLanguageHeader)

  if (isLocale(matchedLocale)) {
    return matchedLocale
  }

  return defaultLocale
}
