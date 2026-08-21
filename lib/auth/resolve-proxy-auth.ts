/**
 * Shared auth resolution from proxy-passed headers.
 *
 * Both `whatsappAuthPlugin.derive()` and the `/api/auth/whoami` debug
 * endpoint need the same resolution logic.  This module extracts it so
 * bug fixes (try-catch, error handling) apply in one place.
 */
import { attachRequestAuth } from "@/lib/api-logging"
import { logger } from "@/lib/logger"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { resolveOrgRole, type OrgRole } from "@/lib/auth/org-role"
import { resolveFirstActiveOrganization } from "@/lib/whatsapp/resolvers"
import {
  getWorkOSSession,
  resolveApiKey,
  extractBearerToken,
} from "@/lib/auth/session"
import type { AuthContext, WorkOSScope } from "@/lib/auth/types"
import { isWellFormedWhatsappOrganizationApiKey } from "@/modules/whatsapp/organization-api-keys/organization-api-key.crypto"
import { verifyWhatsappOrganizationApiKey } from "@/modules/whatsapp/organization-api-keys/organization-api-key.verifier"

export type AuthSource = "proxy_header" | "direct_cookie" | "api_key"

export type ResolvedAuth = { source: AuthSource } & NonNullable<AuthContext>

export type ProxyAuthResult = { ok: true; scope: WorkOSScope } | { ok: false }

/**
 * Normalize a WorkOS role slug to the internal OrgRole type.
 * Accepts both unprefixed (owner/admin/member) and user_prefixed forms.
 */
const normalizeOrgRole = (role: string | null | undefined): OrgRole | null => {
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

  const userId = request.headers.get("x-workos-user-id")?.trim() ?? ""
  if (!userId) {
    return { ok: false }
  }
  const email = request.headers.get("x-workos-user-email")?.trim() ?? null
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
      ? (resolveOrgRoleFromHeaders(request) ??
        (await resolveOrgRole(userId, firstOrg.organizationId)))
      : null

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
    logger.error({ err }, "auth proxy header resolution failed")
    return { ok: false }
  }
}

export const resolveAuthContext = async (
  request: Request
): Promise<ResolvedAuth | null> => {
  const auth = await (async (): Promise<ResolvedAuth | null> => {
    // 1. Proxy-passed WorkOS session (from authkit middleware)
    const proxyResult = await resolveProxyAuth(request)
    if (proxyResult.ok) {
      const scope = proxyResult.scope
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
      logger.error({ err }, "auth direct cookie resolution failed")
    }

    // 3. WhatsApp organization API key (Bearer "wa_live_xxx") — org-scoped,
    // member-level only. Deliberately mapped with scopes: [] so it can never
    // satisfy requireTenantAdmin/requireSuperAdmin (both gate on scopes
    // containing "platform:admin" or "*") — this is a self-service credential
    // an org owner generates for themselves, not a platform-admin-grantable
    // one like a "live_"/"test_" AuthApiKey can be.
    const bearerToken = extractBearerToken(request)
    if (bearerToken && !bearerToken.startsWith("wos_")) {
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("cf-connecting-ip")?.trim() ??
        null

      if (isWellFormedWhatsappOrganizationApiKey(bearerToken)) {
        const orgKeyScope = await verifyWhatsappOrganizationApiKey(
          bearerToken,
          {
            clientIp,
            userAgent: request.headers.get("user-agent"),
          }
        )
        if (orgKeyScope) {
          return {
            type: "platform",
            keyId: orgKeyScope.keyId,
            keyName: "WhatsApp organization API key",
            organizationId: orgKeyScope.organizationId,
            environment: "LIVE",
            scopes: [],
            source: "api_key",
          }
        }
      }

      // 4. Static API key (Bearer "live_xxx" / "test_xxx")
      const apiKeyScope = await resolveApiKey(
        bearerToken,
        clientIp ?? undefined
      )
      if (apiKeyScope) {
        return { ...apiKeyScope, source: "api_key" }
      }
    }

    // 5. No valid auth
    return null
  })()

  if (auth) {
    attachRequestAuth(request, auth)
  }

  return auth
}
