import { localeCookieName, type AppLocale } from "@/lib/i18n/config"
import { localizePathname } from "@/lib/i18n/pathname"

export const indonesianLocalePreferenceVersion = 1
export const indonesianLocalePreferenceStorageKey =
  "pfnapp.indonesian-locale-preference"

export type IndonesianLocaleDecision = "stay" | "switch"

export type IndonesianLocalePreference = {
  version: typeof indonesianLocalePreferenceVersion
  decision: IndonesianLocaleDecision
  cueShown: boolean
}

type BrowserLocaleDetails = {
  languages?: readonly string[]
  language?: string
  timeZone?: string
}

type BrowserStorage = Pick<Storage, "getItem" | "setItem">

const indonesianLanguageTags = new Set(["id", "id-id"])
const indonesianTimeZones = new Set([
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
])

const isIndonesianLanguage = (value: string | undefined) =>
  Boolean(value && indonesianLanguageTags.has(value.toLowerCase()))

const hasIndonesianBrowserLanguage = ({
  languages,
  language,
}: BrowserLocaleDetails) =>
  (languages?.some(isIndonesianLanguage) ?? false) ||
  isIndonesianLanguage(language)

export const isIndonesiaLikely = ({
  languages,
  language,
  timeZone,
}: BrowserLocaleDetails) => {
  if (hasIndonesianBrowserLanguage({ languages, language })) {
    return true
  }

  return Boolean(timeZone && indonesianTimeZones.has(timeZone))
}

export const getBrowserLocaleDetails = (): BrowserLocaleDetails => {
  if (typeof window === "undefined") {
    return {}
  }

  const browserDetails: BrowserLocaleDetails = {
    languages: navigator.languages,
    language: navigator.language,
  }

  if (hasIndonesianBrowserLanguage(browserDetails)) {
    return browserDetails
  }

  try {
    return {
      ...browserDetails,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  } catch {
    return browserDetails
  }
}

export const getBrowserStorage = (): BrowserStorage | null => {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const isPreference = (value: unknown): value is IndonesianLocalePreference => {
  if (!value || typeof value !== "object") {
    return false
  }

  const preference = value as Record<string, unknown>
  return (
    preference.version === indonesianLocalePreferenceVersion &&
    (preference.decision === "stay" || preference.decision === "switch") &&
    typeof preference.cueShown === "boolean"
  )
}

export const readIndonesianLocalePreference = (
  storage: BrowserStorage | null | undefined
) => {
  if (!storage) {
    return null
  }

  try {
    const storedValue = storage.getItem(indonesianLocalePreferenceStorageKey)
    if (!storedValue) {
      return null
    }

    const parsedValue: unknown = JSON.parse(storedValue)
    return isPreference(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

export const writeIndonesianLocalePreference = ({
  storage,
  decision,
  cueShown = false,
}: {
  storage: BrowserStorage | null | undefined
  decision: IndonesianLocaleDecision
  cueShown?: boolean
}) => {
  if (!storage) {
    return false
  }

  const preference: IndonesianLocalePreference = {
    version: indonesianLocalePreferenceVersion,
    decision,
    cueShown,
  }

  try {
    storage.setItem(
      indonesianLocalePreferenceStorageKey,
      JSON.stringify(preference)
    )
    return true
  } catch {
    return false
  }
}

export const shouldShowIndonesianLocalePrompt = ({
  locale,
  preference,
  browserDetails,
}: {
  locale: AppLocale
  preference: IndonesianLocalePreference | null
  browserDetails: BrowserLocaleDetails
}) => locale === "en" && !preference && isIndonesiaLikely(browserDetails)

export const shouldRunIndonesianLocaleCue = (
  preference: IndonesianLocalePreference | null
) => Boolean(preference && !preference.cueShown)

export const buildLocalizedPath = ({
  pathname,
  search,
  locale,
}: {
  pathname: string
  search: string
  locale: AppLocale
}) => {
  const localizedPathname = localizePathname({ pathname, locale })
  const normalizedSearch = search.replace(/^\?/, "")

  return normalizedSearch
    ? `${localizedPathname}?${normalizedSearch}`
    : localizedPathname
}

export const setLocaleCookie = (locale: AppLocale) => {
  if (typeof document === "undefined") {
    return
  }

  document.cookie = buildLocaleCookie(locale)
}

export const buildLocaleCookie = (locale: AppLocale) =>
  `${localeCookieName}=${locale}; Path=/; SameSite=Lax`
