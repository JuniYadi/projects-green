/**
 * Debug endpoint — returns the current auth context regardless of auth method.
 *
 * Browser (cookie):  GET  /api/auth/whoami
 * curl (API key):    curl http://localhost:3300/api/auth/whoami \
 *                      -H "Authorization: Bearer live_xxx"
 *
 * The response shape mirrors the whatsappAuth context injected by
 * whatsappAuthPlugin, so you can verify session resolution from any client.
 */
import { Elysia } from "elysia"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { getWorkOSSession, resolveApiKey, extractBearerToken } from "@/lib/auth/session"
import { resolveOrgRole } from "@/lib/auth/org-role"
import { resolveFirstActiveOrganization } from "@/lib/whatsapp/resolvers"

export const authWhoamiRoute = new Elysia()
  .get("/auth/whoami", async ({ request }) => {
    // 1. Proxy-passed WorkOS session (from authkit middleware)
    const proxyAuthed = request.headers.get("x-workos-authed")
    if (proxyAuthed === "true") {
      const userId = request.headers.get("x-workos-user-id") ?? ""
      const email = request.headers.get("x-workos-user-email") ?? null
      const role = request.headers.get("x-workos-session-role") ?? undefined
      const rolesHeader = request.headers.get("x-workos-session-roles")
      const roles = rolesHeader ? (JSON.parse(rolesHeader) as string[]) : undefined

      const platformRole = await getPlatformRoleForUser({ id: userId, email })
      const firstOrg = await resolveFirstActiveOrganization(userId)
      const orgRole = firstOrg
        ? await resolveOrgRole(userId, firstOrg.organizationId)
        : null

      return {
        ok: true as const,
        auth: {
          type: "workos" as const,
          source: "proxy_header" as const,
          userId,
          email,
          organizationId: firstOrg?.organizationId ?? null,
          orgRole,
          platformRole,
          org: firstOrg,
        },
      }
    }

    // 2. Direct WorkOS session (cookie / wos_ bearer)
    const workosUser = await getWorkOSSession(request)
    if (workosUser) {
      const platformRole = await getPlatformRoleForUser(workosUser)
      const firstOrg = await resolveFirstActiveOrganization(workosUser.id)
      const orgRole = firstOrg
        ? await resolveOrgRole(workosUser.id, firstOrg.organizationId)
        : null
      return {
        ok: true as const,
        auth: {
          type: "workos" as const,
          source: "direct_cookie" as const,
          userId: workosUser.id,
          email: workosUser.email ?? null,
          organizationId: firstOrg?.organizationId ?? null,
          orgRole,
          platformRole,
          org: firstOrg,
        },
      }
    }

    // 3. Static API key
    const bearerToken = extractBearerToken(request)
    if (bearerToken && !bearerToken.startsWith("wos_")) {
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("cf-connecting-ip")?.trim() ??
        null
      const apiKeyScope = await resolveApiKey(bearerToken, clientIp ?? undefined)
      if (apiKeyScope) {
        return {
          ok: true as const,
          auth: {
            ...apiKeyScope,
            source: "api_key" as const,
          },
        }
      }
    }

    // 4. No valid auth
    return {
      ok: false as const,
      auth: null,
      message:
        "No valid session or API key. Try: curl ... -H 'Authorization: Bearer live_xxx'",
    }
  })