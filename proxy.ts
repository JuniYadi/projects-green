import { authkit, handleAuthkitHeaders } from "@workos-inc/authkit-nextjs"
import { NextRequest, NextResponse } from "next/server"

import {
  localeCookieName,
  type AppLocale,
} from "@/lib/i18n/config"
import { resolveRequestLocale } from "@/lib/i18n/request-locale"
import {
  getLocaleFromPathname,
  localizePathname,
} from "@/lib/i18n/pathname"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  hasScopedSuperAdminClaim,
  resolveScopedRoleTargetFromClaims,
} from "@/modules/tenants/tenant-policy"

const CONSOLE_HOME = "/console"
const PORTAL_HOME = "/portal"

const PROTECTED_PATHS = [CONSOLE_HOME, PORTAL_HOME]
const LOCALE_EXCLUDED_PATHS = ["/api", "/callback"]

type UserArea = "console" | "portal"

const isProtectedPath = (pathname: string) => {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

const isPortalPath = (pathname: string) => {
  return pathname === PORTAL_HOME || pathname.startsWith(`${PORTAL_HOME}/`)
}

const isConsolePath = (pathname: string) => {
  return pathname === CONSOLE_HOME || pathname.startsWith(`${CONSOLE_HOME}/`)
}

const getHomePath = (area: UserArea) => {
  return area === "portal" ? PORTAL_HOME : CONSOLE_HOME
}

const shouldSkipLocaleRouting = (pathname: string) => {
  return LOCALE_EXCLUDED_PATHS.some(
    (excludedPath) =>
      pathname === excludedPath || pathname.startsWith(`${excludedPath}/`)
  )
}

const withLocaleCookie = (response: NextResponse, locale: AppLocale) => {
  response.cookies.set(localeCookieName, locale, { path: "/" })
  return response
}

const getPreferredLocale = (request: NextRequest): AppLocale =>
  resolveRequestLocale({
    acceptLanguageHeader: request.headers.get("accept-language") ?? undefined,
    cookieLocale: request.cookies.get(localeCookieName)?.value,
  })

const withLocalePrefix = (pathname: string, locale: AppLocale) => {
  return localizePathname({
    pathname,
    locale,
  })
}

const resolveUserArea = (session: { role?: string; roles?: string[] }) => {
  const scopedRoleTarget = resolveScopedRoleTargetFromClaims(
    session.role,
    session.roles
  )

  if (scopedRoleTarget === "admin") {
    return "portal" as const
  }

  if (scopedRoleTarget === "user") {
    return "console" as const
  }

  return null
}

export default async function proxy(request: NextRequest) {
  const { session, headers } = await authkit(request)
  const { pathname, search } = request.nextUrl
  const {
    locale: localeFromPathname,
    pathnameWithoutLocale,
  } = getLocaleFromPathname(pathname)
  const locale = localeFromPathname ?? getPreferredLocale(request)
  const normalizedPathname = pathnameWithoutLocale

  if (!localeFromPathname && !shouldSkipLocaleRouting(normalizedPathname)) {
    const localizedPathname = withLocalePrefix(normalizedPathname, locale)
    const redirectUrl = new URL(`${localizedPathname}${search}`, request.url)

    return withLocaleCookie(NextResponse.redirect(redirectUrl), locale)
  }

  const responseOptions = (options?: { redirect: string }) => {
    if (!options) {
      return withLocaleCookie(handleAuthkitHeaders(request, headers), locale)
    }

    return withLocaleCookie(
      handleAuthkitHeaders(request, headers, options),
      locale
    )
  }

  if (isProtectedPath(normalizedPathname) && !session.user) {
    const next = withLocalePrefix(normalizedPathname, locale)
    const localizedNext = `${next}${search}`
    const loginPath = `${withLocalePrefix("/login", locale)}?next=${encodeURIComponent(localizedNext)}`

    return responseOptions({
      redirect: loginPath,
    })
  }

  if (!session.user) {
    return responseOptions()
  }

  const platformRole =
    (await getPlatformRoleForUser({
      id: session.user.id,
      email: session.user.email,
    }).catch(() => "none")) ?? "none"
  const hasClaimedSuperAdmin = hasScopedSuperAdminClaim(
    session.role,
    session.roles
  )
  const isSuperAdmin = platformRole === "super_admin" || hasClaimedSuperAdmin

  const userArea = resolveUserArea(session)

  if (normalizedPathname === "/") {
    if (isSuperAdmin) {
      return responseOptions({
        redirect: withLocalePrefix(PORTAL_HOME, locale),
      })
    }

    if (!userArea) {
      console.warn(
        "[auth] Signed-in user missing expected WorkOS role claims for root route; falling back to console."
      )

      return responseOptions({
        redirect: withLocalePrefix(CONSOLE_HOME, locale),
      })
    }

    return responseOptions({
      redirect: withLocalePrefix(getHomePath(userArea), locale),
    })
  }

  if (!isPortalPath(normalizedPathname) && !isConsolePath(normalizedPathname)) {
    return responseOptions()
  }

  if (isSuperAdmin) {
    return responseOptions()
  }

  if (!userArea) {
    console.warn(
      "[auth] Signed-in user missing expected WorkOS role claims for protected route; limiting access to console."
    )

    if (isPortalPath(normalizedPathname)) {
      return responseOptions({
        redirect: withLocalePrefix(CONSOLE_HOME, locale),
      })
    }

    return responseOptions()
  }

  const areaHomePath = getHomePath(userArea)
  const isAuthorizedPath =
    userArea === "portal"
      ? isPortalPath(normalizedPathname)
      : isConsolePath(normalizedPathname)

  if (!isAuthorizedPath) {
    return responseOptions({
      redirect: withLocalePrefix(areaHomePath, locale),
    })
  }

  return responseOptions()
}

export const config = {
  matcher: [
    /*
     * Run AuthKit middleware for all app routes so `withAuth` calls from
     * AuthKitProvider are always covered.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)",
  ],
}
