import { authkit, handleAuthkitHeaders } from "@workos-inc/authkit-nextjs"
import { NextRequest } from "next/server"

import { getPlatformRoleForUser } from "@/lib/platform-role"

const CONSOLE_HOME = "/console"
const PORTAL_HOME = "/portal"

const USER_ROLES = new Set(["member", "user"])
const ADMIN_ROLES = new Set(["owner", "admin"])

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
  const claimedRoles = [session.role, ...(session.roles ?? [])]
    .map((role) => role?.trim().toLowerCase())
    .filter((role): role is string => Boolean(role))

  if (claimedRoles.some((role) => ADMIN_ROLES.has(role))) {
    return "portal" as const
  }

  if (claimedRoles.some((role) => USER_ROLES.has(role))) {
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

  const userArea = resolveUserArea(session)

  if (pathname === "/") {
    if (platformRole === "super_admin") {
      return handleAuthkitHeaders(request, headers, {
        redirect: PORTAL_HOME,
      })
    }

    if (!userArea) {
      console.warn("[auth] Signed-in user missing expected WorkOS role claims for root route.")

      return handleAuthkitHeaders(request, headers, {
        redirect: "/login",
      })
    }

    return handleAuthkitHeaders(request, headers, {
      redirect: getHomePath(userArea),
    })
  }

  if (!isPortalPath(pathname) && !isConsolePath(pathname)) {
    return handleAuthkitHeaders(request, headers)
  }

  if (platformRole === "super_admin") {
    return handleAuthkitHeaders(request, headers)
  }

  if (!userArea) {
    console.warn("[auth] Signed-in user missing expected WorkOS role claims for protected route.")

    return handleAuthkitHeaders(request, headers, {
      redirect: "/login",
    })
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
