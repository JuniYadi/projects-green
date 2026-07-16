/**
 * Shared auth resolution from proxy-passed headers.
 *
 * Both `whatsappAuthPlugin.derive()` and the `/api/auth/whoami` debug
 * endpoint need the same resolution logic.  This module extracts it so
 * bug fixes (try-catch, error handling) apply in one place.
 */

import { getPlatformRoleForUser } from "@/lib/platform-role"
import { resolveOrgRole, type OrgRole } from "@/lib/auth/org-role"
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
 * Normalize a WorkOS role slug to the internal OrgRole type.
 * Accepts both unprefixed (owner/admin/member) and user_prefixed forms.
 */
const normalizeOrgRole = (
  role: string | null | undefined
): OrgRole | null => {
  if (!role) return null
  const slug = role.toLowerCase()
  if (slug === "owner" || slug === "user_owner") return "owner"
  if (slug === "admin" || slug === "user_admin") return "admin"
  if (slug === "member" || slug === "user_member") return "member"
  return null
}

/**
 * Resolve org role from proxy-passed x-workos-session-role / x-workos-session-roles headers.
 * Avoids a WorkOS membership API call when headers are present.
 */
const resolveOrgRoleFromHeaders = (request: Request): OrgRole | null => {
  const single = request.headers.get("x-workos-session-role")
  if (single) {
    const normalized = normalizeOrgRole(single)
    if (normalized) return normalized
  }
  const raw = request.headers.get("x-workos-session-roles")
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      for (const r of parsed) {
        if (typeof r === "string") {
          const normalized = normalizeOrgRole(r)
          if (normalized) return normalized
        }
      }
    }
  } catch {
    // malformed JSON — ignore
  }
  return null
}

export const resolveProxyAuth = async (
  request: Request
): Promise<ProxyAuthResult> => {
  const proxyAuthed = request.headers.get("x-workos-authed")
  if (proxyAuthed !== "true") {
    return { ok: false }
  }

  const userId = request.headers.get("x-workos-user-id") ?? ""
  const email = request.headers.get("x-workos-user-email") ?? null
  const headerOrganizationId =
    request.headers.get("x-workos-organization-id")?.trim() || null

  try {
    const platformRole = await getPlatformRoleForUser({ id: userId, email })

    // Prefer the org from the proxy header (which AuthKit resolved during
    // session refresh) over asking WorkOS again.  Avoids the reported
    // "Request timeout" from resolveFirstActiveOrganization.
    const firstOrg = headerOrganizationId
      ? { organizationId: headerOrganizationId }
      : await resolveFirstActiveOrganization(userId)

    const orgRole = firstOrg
      ? resolveOrgRoleFromHeaders(request) ??
        (await resolveOrgRole(userId, firstOrg.organizationId))
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
