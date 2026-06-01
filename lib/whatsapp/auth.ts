/**
 * WhatsApp API — Auth middleware (Elysia plugin).
 *
 * Resolution order:
 *  1. WorkOS sealed session (cookie OR Bearer "wos_xxx")  → WorkOS user context
 *  2. Static API key (Bearer "live_xxx" / "test_xxx")     → platform scope (no org)
 *  3. No valid auth → 401
 *
 * Guard functions are imported from @/lib/auth/guards and are reusable
 * across all modules.
 */

import { Elysia } from "elysia"

import { getPlatformRoleForUser } from "@/lib/platform-role"
import { getWorkOSSession, resolveApiKey, extractBearerToken } from "@/lib/auth/session"
import { resolveOrgRole } from "@/lib/auth/org-role"
import { resolveFirstActiveOrganization } from "./resolvers"

// Re-export everything from lib/auth for backward compatibility
export type {
  AuthContext,
  WorkOSScope,
  PlatformScope,
} from "@/lib/auth/types"
export { isPlatformScope, isWorkOSScope } from "@/lib/auth/types"
export { resolveOrgRole } from "@/lib/auth/org-role"
export { ORG_ROLES } from "@/lib/auth/org-role"
export type { OrgRole } from "@/lib/auth/org-role"
export {
  getWorkOSSession,
  resolveApiKey,
  extractBearerToken,
} from "@/lib/auth/session"
export {
  guardOrgRead,
  guardOrgWrite,
  guardOrgFull,
  guardSuperAdmin,
} from "@/lib/auth/guards"

// Backward-compatible aliases — will be removed after route migration
export { guardOrgRead as guardTenantMember } from "@/lib/auth/guards"
export { guardOrgWrite as guardTenantAdmin } from "@/lib/auth/guards"

// Re-export WhatsAppAuthContext as AuthContext alias
export type { AuthContext as WhatsAppAuthContext } from "@/lib/auth/types"

// Boolean helper functions (used by tests and simple guard checks)
import type { AuthContext, WorkOSScope } from "@/lib/auth/types"

const isSuperAdmin = (ctx: WorkOSScope) => ctx.platformRole === "super_admin"
const hasOrgMembership = (ctx: WorkOSScope) => ctx.organizationId !== null

export const requireWorkOSSession = (
  ctx: AuthContext
): ctx is WorkOSScope => ctx.type === "workos"

export const requireApiKey = (
  ctx: AuthContext
): ctx is import("@/lib/auth/types").PlatformScope => ctx.type === "platform"

export const requireSuperAdmin = (ctx: AuthContext): boolean => {
  if (ctx.type === "platform") {
    return (
      Array.isArray(ctx.scopes) &&
      (ctx.scopes.includes("platform:admin") || ctx.scopes.includes("*"))
    )
  }
  return isSuperAdmin(ctx)
}

export const requireTenantMember = (ctx: AuthContext): boolean => {
  if (ctx.type === "platform") return false
  return hasOrgMembership(ctx)
}

export const requireTenantAdmin = (ctx: AuthContext): boolean => {
  if (ctx.type === "platform") return false
  if (isSuperAdmin(ctx)) return true
  return ctx.orgRole === "admin" || ctx.orgRole === "owner"
}
export { hashApiKey } from "./crypto"
export type { ApiKeyEnvironment } from "@prisma/client"

// ─── Elysia plugin ────────────────────────────────────────────────────────────

export const whatsappAuthPlugin = new Elysia({ name: "whatsapp.auth" })
  .derive(async ({ request }) => {
    const workosUser = await getWorkOSSession(request)
    if (workosUser) {
      const platformRole = await getPlatformRoleForUser(workosUser)
      const firstOrg = await resolveFirstActiveOrganization(workosUser.id)
      const orgRole = firstOrg
        ? await resolveOrgRole(workosUser.id, firstOrg.organizationId)
        : null
      return {
        whatsappAuth: {
          type: "workos" as const,
          userId: workosUser.id,
          email: workosUser.email ?? null,
          organizationId: firstOrg?.organizationId ?? null,
          orgRole,
          platformRole,
        },
      }
    }

    const bearerToken = extractBearerToken(request)
    if (bearerToken) {
      if (bearerToken.startsWith("wos_")) {
        return { whatsappAuth: null }
      }
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("cf-connecting-ip")?.trim() ??
        null
      const apiKeyScope = await resolveApiKey(bearerToken, clientIp ?? undefined)
      if (apiKeyScope) {
        return { whatsappAuth: apiKeyScope }
      }
    }

    return { whatsappAuth: null }
  })
  .onBeforeHandle(({ whatsappAuth, set }) => {
    if (!whatsappAuth) {
      set.status = 401
      return {
        ok: false,
        error: "UNAUTHORIZED",
        message: "Valid WorkOS session or API key required.",
      }
    }
  })
