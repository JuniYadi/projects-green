/**
 * Shared auth resolution from proxy-passed headers.
 *
 * Both `whatsappAuthPlugin.derive()` and the `/api/auth/whoami` debug
 * endpoint need the same resolution logic.  This module extracts it so
 * bug fixes (try-catch, error handling) apply in one place.
 */

import { getPlatformRoleForUser } from "@/lib/platform-role"
import { resolveOrgRole } from "@/lib/auth/org-role"
import { resolveFirstActiveOrganization } from "@/lib/whatsapp/resolvers"
import {
  getWorkOSSession,
  resolveApiKey,
  extractBearerToken,
} from "@/lib/auth/session"
import type { AuthContext, WorkOSScope } from "@/lib/auth/types"

export type AuthSource = "proxy_header" | "direct_cookie" | "api_key"

export type ResolvedAuth = { source: AuthSource } & NonNullable<AuthContext>

export type ProxyAuthResult = { ok: true; scope: WorkOSScope } | { ok: false }

/**
 * Resolve auth context from proxy-passed `x-workos-*` headers.
 *
 * Returns `{ ok: false }` when the headers are absent or the downstream
 * DB calls fail (logged, never thrown to the client).
 */
export const resolveProxyAuth = async (
  request: Request
): Promise<ProxyAuthResult> => {
  const proxyAuthed = request.headers.get("x-workos-authed")
  if (proxyAuthed !== "true") {
    return { ok: false }
  }

  const userId = request.headers.get("x-workos-user-id") ?? ""
  const email = request.headers.get("x-workos-user-email") ?? null

  try {
    const platformRole = await getPlatformRoleForUser({ id: userId, email })
    const firstOrg = await resolveFirstActiveOrganization(userId)
    const orgRole = firstOrg
      ? await resolveOrgRole(userId, firstOrg.organizationId)
      : null

    console.debug(
      "[auth] proxy header: userId=%s orgId=%s orgRole=%s",
      userId,
      firstOrg?.organizationId ?? null,
      orgRole
    )

    return {
      ok: true,
      scope: {
        type: "workos",
        userId,
        email,
        organizationId: firstOrg?.organizationId ?? null,
        orgRole,
        platformRole,
      },
    }
  } catch (err) {
    console.error("[auth] proxy header resolution failed", err)
    return { ok: false }
  }
}

export const resolveAuthContext = async (
  request: Request
): Promise<ResolvedAuth | null> => {
  // 1. Proxy-passed WorkOS session (from authkit middleware)
  const proxyResult = await resolveProxyAuth(request)
  if (proxyResult.ok) {
    const scope = proxyResult.scope
    console.debug(
      "[auth] resolveAuthContext: source=proxy_header userId=%s",
      scope.userId
    )
    return { ...scope, source: "proxy_header" }
  }

  // 2. Direct WorkOS session (cookie / wos_ bearer)
  try {
    const workosUser = await getWorkOSSession(request)
    if (workosUser) {
      const platformRole = await getPlatformRoleForUser(workosUser)
      const firstOrg = await resolveFirstActiveOrganization(workosUser.id)
      const orgRole = firstOrg
        ? await resolveOrgRole(workosUser.id, firstOrg.organizationId)
        : null
      console.debug(
        "[auth] resolveAuthContext: source=direct_cookie userId=%s",
        workosUser.id
      )
      return {
        type: "workos",
        userId: workosUser.id,
        email: workosUser.email ?? null,
        organizationId: firstOrg?.organizationId ?? null,
        orgRole,
        platformRole,
        source: "direct_cookie",
      }
    }
  } catch (err) {
    console.error("[auth] direct cookie resolution failed", err)
  }

  // 3. Static API key (Bearer "live_xxx" / "test_xxx")
  const bearerToken = extractBearerToken(request)
  if (bearerToken && !bearerToken.startsWith("wos_")) {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("cf-connecting-ip")?.trim() ??
      null
    const apiKeyScope = await resolveApiKey(bearerToken, clientIp ?? undefined)
    if (apiKeyScope) {
      console.debug(
        "[auth] resolveAuthContext: source=api_key keyId=%s",
        apiKeyScope.keyId
      )
      return { ...apiKeyScope, source: "api_key" }
    }
  }

  // 4. No valid auth
  console.debug("[auth] resolveAuthContext: no valid auth")
  return null
}
