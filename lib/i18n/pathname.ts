import {
  defaultLocale,
  locales,
  type AppLocale,
} from "@/lib/i18n/config"

export const isLocale = (value: string): value is AppLocale => {
  return locales.includes(value as AppLocale)
}

const normalizePathname = (pathname: string) => {
  if (!pathname) {
    return "/"
  }

  return pathname.startsWith("/") ? pathname : `/${pathname}`
}

const isDynamicRouteSegment = (segment: string) => {
  return segment.startsWith("[") && segment.endsWith("]")
}

export const getLocaleFromPathname = (pathname: string) => {
  const normalizedPathname = normalizePathname(pathname)
  const [empty, maybeLocale, ...rest] = normalizedPathname.split("/")

  if (empty !== "") {
    return {
      locale: null,
      pathnameWithoutLocale: normalizedPathname,
    }
  }

  if (!maybeLocale || !isLocale(maybeLocale)) {
    if (maybeLocale && isDynamicRouteSegment(maybeLocale)) {
      const remainder = rest.join("/")

      return {
        locale: null,
        pathnameWithoutLocale: remainder ? `/${remainder}` : "/",
      }
    }

    return {
      locale: null,
      pathnameWithoutLocale: normalizedPathname,
    }
  }

  const remainder = rest.join("/")
  const pathnameWithoutLocale = remainder ? `/${remainder}` : "/"

  return {
    locale: maybeLocale,
    pathnameWithoutLocale,
  }
}

export const getPathnameWithoutLocale = (pathname: string) => {
  return getLocaleFromPathname(pathname).pathnameWithoutLocale
}

export const localizePathname = ({
  pathname,
  locale,
}: {
  pathname: string
  locale: AppLocale
}) => {
  const normalizedPathname = getPathnameWithoutLocale(pathname)

  if (normalizedPathname === "/") {
    return `/${locale}`
  }

  return `/${locale}${normalizedPathname}`
}

export const resolveLocaleOrDefault = (value: string | undefined | null) => {
  if (value && isLocale(value)) {
    return value
  }

  return defaultLocale
}
