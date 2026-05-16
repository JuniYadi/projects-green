import { authkit, handleAuthkitHeaders } from "@workos-inc/authkit-nextjs"
import { NextRequest } from "next/server"

import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  hasScopedSuperAdminClaim,
  resolveScopedRoleTargetFromClaims,
} from "@/modules/tenants/tenant-policy"

const CONSOLE_HOME = "/console"
const PORTAL_HOME = "/portal"

const PROTECTED_PATHS = ["/", CONSOLE_HOME, PORTAL_HOME]

type UserArea = "console" | "portal"

const isProtectedPath = (pathname: string) => {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
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

  if (isProtectedPath(pathname) && !session.user) {
    const next = `${pathname}${search}`
    const loginPath = `/login?next=${encodeURIComponent(next)}`

    return handleAuthkitHeaders(request, headers, {
      redirect: loginPath,
    })
  }

  if (!session.user) {
    return handleAuthkitHeaders(request, headers)
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
  const isSuperAdmin =
    platformRole === "super_admin" || hasClaimedSuperAdmin

  const userArea = resolveUserArea(session)

  if (pathname === "/") {
    if (isSuperAdmin) {
      return handleAuthkitHeaders(request, headers, {
        redirect: PORTAL_HOME,
      })
    }

    if (!userArea) {
      console.warn(
        "[auth] Signed-in user missing expected WorkOS role claims for root route; falling back to console."
      )

      return handleAuthkitHeaders(request, headers, {
        redirect: CONSOLE_HOME,
      })
    }

    return handleAuthkitHeaders(request, headers, {
      redirect: getHomePath(userArea),
    })
  }

  if (!isPortalPath(pathname) && !isConsolePath(pathname)) {
    return handleAuthkitHeaders(request, headers)
  }

  if (isSuperAdmin) {
    return handleAuthkitHeaders(request, headers)
  }

  if (!userArea) {
    console.warn(
      "[auth] Signed-in user missing expected WorkOS role claims for protected route; limiting access to console."
    )

    if (isPortalPath(pathname)) {
      return handleAuthkitHeaders(request, headers, {
        redirect: CONSOLE_HOME,
      })
    }

    return handleAuthkitHeaders(request, headers)
  }

  const areaHomePath = getHomePath(userArea)
  const isAuthorizedPath = userArea === "portal" ? isPortalPath(pathname) : isConsolePath(pathname)

  if (!isAuthorizedPath) {
    return handleAuthkitHeaders(request, headers, {
      redirect: areaHomePath,
    })
  }

  return handleAuthkitHeaders(request, headers)
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
