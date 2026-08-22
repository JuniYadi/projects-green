import { type AppLocale } from "@/lib/i18n/config"
import { isLocale } from "@/lib/i18n/pathname"

export const WORKOS_ALLOWED_ORIGINS = [
  "https://pfnapp.id",
  "https://pfnapp.my.id",
  "http://localhost:3300",
] as const

const isAllowedOrigin = (
  origin: string
): origin is (typeof WORKOS_ALLOWED_ORIGINS)[number] => {
  return WORKOS_ALLOWED_ORIGINS.includes(
    origin as (typeof WORKOS_ALLOWED_ORIGINS)[number]
  )
}

const getConfiguredRedirectUri = () => {
  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI?.trim()
  return redirectUri || undefined
}

export const getWorkOSPublicOrigin = () => {
  const redirectUri = getConfiguredRedirectUri()

  if (!redirectUri) {
    return undefined
  }

  try {
    const url = new URL(redirectUri)

    if (
      url.pathname !== "/callback" ||
      url.search ||
      url.hash ||
      !isAllowedOrigin(url.origin)
    ) {
      return undefined
    }

    return url.origin
  } catch {
    return undefined
  }
}

export const getWorkOSLogoutReturnTo = (locale: AppLocale) => {
  if (!isLocale(locale)) {
    return undefined
  }

  const origin = getWorkOSPublicOrigin()
  return origin ? new URL(`/${locale}/login`, origin).toString() : undefined
}
