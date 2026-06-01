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
import type { WorkOSScope } from "@/lib/auth/types"

export type ProxyAuthResult =
  | { ok: true; scope: WorkOSScope }
  | { ok: false }

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
