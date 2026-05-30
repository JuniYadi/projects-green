/**
 * WhatsApp API — Auth middleware
 * Dual auth: WorkOS session (browser/UI callers) + Static API key (programmatic callers).
 *
 * Resolution order:
 *  1. WorkOS sealed session (cookie OR Bearer "wos_xxx")  → WorkOS user context
 *  2. Static API key (Bearer "live_xxx" / "test_xxx")     → platform scope (no org)
 *  3. No valid auth → 401
 *
 * Guards attached to routes:
 *  • requireWorkOSSession   — rejects API key callers + unauthenticated
 *  • requireApiKey          — rejects WorkOS callers + unauthenticated
 *  • requireSuperAdmin      — rejects non-super_admin (platform role check)
 *  • requireTenantMember    — rejects callers without at least tenant membership
 */

import { createWorkOS } from "@workos-inc/node"
import type { User } from "@workos-inc/node"
import { unsealData } from "iron-session"
import { Elysia, t } from "elysia"
import type { ApiKeyEnvironment } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { TENANT_ROLES, type TenantRole } from "@/modules/tenants/tenant-policy"
import { hashApiKey } from "./crypto"

// Re-export for testing
export { hashApiKey }
export type { ApiKeyEnvironment }

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlatformScope = {
  type: "platform"
  keyId: string
  keyName: string
  environment: "SANDBOX" | "LIVE"
  scopes: string[]
}

export type WorkOSScope = {
  type: "workos"
  userId: string
  email: string | null
  organizationId: string | null
  tenantRole: TenantRole | null
  platformRole: "none" | "super_admin"
}

export type WhatsAppAuthContext = PlatformScope | WorkOSScope

// ─── Elysia type augmentation ─────────────────────────────────────────────────
// Extend Elysia's local context so that route handlers typed with guard/wrapper
// functions can infer `whatsappAuth` without explicit annotation.

declare module "elysia" {
  interface LocalContext {
    whatsappAuth: WhatsAppAuthContext
  }
}
export const isPlatformScope = (ctx: WhatsAppAuthContext): ctx is PlatformScope =>
  ctx.type === "platform"

export const isWorkOSScope = (ctx: WhatsAppAuthContext): ctx is WorkOSScope =>
  ctx.type === "workos"

const isSuperAdmin = (ctx: WorkOSScope) => ctx.platformRole === "super_admin"

const hasTenantMembership = (ctx: WorkOSScope) =>
  ctx.organizationId !== null

// ─── WorkOS session resolver ─────────────────────────────────────────────────

export const getWorkOSSession = async (
  request: Request
): Promise<User | null> => {
  // 1. Bearer token — prioritize for programmatic callers
  const authHeader = request.headers.get("Authorization") ?? ""
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null

  if (bearerToken) {
    // WorkOS session tokens are prefixed "wos_"
    if (bearerToken.startsWith("wos_")) {
      try {
        const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD?.trim()
        if (!cookiePassword) return null
        const sessionPayload = await unsealData(bearerToken, { password: cookiePassword })
        if (sessionPayload && typeof sessionPayload === 'object' && 'user' in sessionPayload) {
          return (sessionPayload as { user: User }).user
        }
      } catch {
        // invalid/expired session token
        return null
      }
    }
    // API key tokens handled below — not WorkOS session
  }

  // 2. Cookie — wos-session (browser)
  const cookieName = process.env.WORKOS_COOKIE_NAME?.trim() || "wos-session"
  const rawCookies = request.headers.get("Cookie") ?? ""
  const cookies = Object.fromEntries(
    rawCookies.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=")
      return [k, v.join("=")]
    })
  )
  const sealedSession = cookies[cookieName]
  if (!sealedSession) return null

  try {
    const cookiePassword = process.env.WORKOS_COOKIE_PASSWORD?.trim()
    if (!cookiePassword) return null
    const sessionPayload = await unsealData(sealedSession, { password: cookiePassword })
    if (sessionPayload && typeof sessionPayload === 'object' && 'user' in sessionPayload) {
      return (sessionPayload as { user: User }).user ?? null
    }
    return null
  } catch {
    return null
  }
}

/**
 * Resolve the tenant-level role for a WorkOS user in a given organization.
 * Queries WorkOS organization memberships and maps the role slug.
 */
export const resolveTenantRole = async (
  userId: string,
  organizationId: string
): Promise<TenantRole | null> => {
  try {
    const workos = createWorkOS({ apiKey: process.env.WORKOS_API_KEY ?? "" })
    const memberships = await workos.userManagement
      .listOrganizationMemberships({
        userId,
        organizationId,
        statuses: ["active"],
      })
      .then((r) => r.autoPagination())

    const active = memberships[0]
    if (!active?.role?.slug) return null

    const slug = active.role.slug.toLowerCase()
    if (slug === "user_owner") return "owner"
    if (slug === "user_admin") return "admin"
    if (slug === "user_member") return "member"
    return null
  } catch {
    return null
  }
}

// ─── API key resolver ──────────────────────────────────────────────────────────

const API_KEY_HASH_SALT = () =>
  process.env.API_KEY_HASH_SALT?.trim() ?? "dev-salt-change-me"

const API_KEY_PREFIXES = {
  SANDBOX: "test_",
  LIVE: "live_",
} as const

/**
 * Validate a raw API key against the stored keyHash in the ApiKey table.
 * Supports both `live_xxx` and `test_xxx` prefix formats.
 * Updates `lastUsedAt` / `lastUsedIp` on successful lookup.
 */
export const resolveApiKey = async (
  rawKey: string,
  clientIp?: string
): Promise<PlatformScope | null> => {
  // Determine environment from prefix
  let environment: ApiKeyEnvironment = "LIVE"
  let normalizedKey = rawKey

  if (rawKey.startsWith(API_KEY_PREFIXES.SANDBOX)) {
    environment = "SANDBOX"
    normalizedKey = rawKey.slice(API_KEY_PREFIXES.SANDBOX.length)
  } else if (rawKey.startsWith(API_KEY_PREFIXES.LIVE)) {
    normalizedKey = rawKey.slice(API_KEY_PREFIXES.LIVE.length)
  }

  const salt = API_KEY_HASH_SALT()
  const keyHash = await hashApiKey(normalizedKey, salt)

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      environment: environment,
      active: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  })

  if (!apiKey) return null

  // Touch last-used metadata (fire-and-forget, don't block auth)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: clientIp ?? null,
      },
    })
    .catch(() => {}) // swallow errors — auth already succeeded

  return {
    type: "platform",
    keyId: apiKey.id,
    keyName: apiKey.name,
    environment: apiKey.environment as ApiKeyEnvironment,
    scopes: apiKey.scopes as string[],
  }
}

/**
 * Convenience: extract raw Bearer token from Authorization header.
 * Returns null if the header is missing or not Bearer.
 */
export const extractBearerToken = (request: Request): string | null => {
  const auth = request.headers.get("Authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  const token = auth.slice(7).trim()
  return token || null
}

// ─── Guard helpers ─────────────────────────────────────────────────────────────

/** Guard: caller MUST be an authenticated WorkOS user (no API key, no anonymous). */
export const requireWorkOSSession = (
  ctx: WhatsAppAuthContext
): ctx is WorkOSScope => ctx.type === "workos"

/** Guard: caller MUST be an API key (no WorkOS session). */
export const requireApiKey = (
  ctx: WhatsAppAuthContext
): ctx is PlatformScope => ctx.type === "platform"

/**
 * Guard: caller MUST have super_admin platform role.
 * Applies to both WorkOS (platform role DB lookup) and API key (must carry `platform:admin` scope).
 */
export const requireSuperAdmin = (
  ctx: WhatsAppAuthContext
): boolean => {
  if (ctx.type === "platform") {
    return (
      Array.isArray(ctx.scopes) &&
      (ctx.scopes.includes("platform:admin") ||
        ctx.scopes.includes("*"))
    )
  }
  return isSuperAdmin(ctx)
}

/**
 * Guard: caller MUST have at least a tenant membership (owner/admin/member).
 * API key callers have no org scope — they cannot satisfy this guard.
 */
export const requireTenantMember = (
  ctx: WhatsAppAuthContext
): boolean => {
  if (ctx.type === "platform") return false
  return hasTenantMembership(ctx)
}

/**
 * Guard: caller MUST have at least `admin` tenant role OR super_admin.
 * API key callers cannot satisfy this — they have no org scope.
 */
export const requireTenantAdmin = (
  ctx: WhatsAppAuthContext
): boolean => {
  if (ctx.type === "platform") return false
  if (isSuperAdmin(ctx)) return true
  return ctx.tenantRole === "admin" || ctx.tenantRole === "owner"
}

// ─── Elysia plugin ────────────────────────────────────────────────────────────

export const whatsappAuthPlugin = new Elysia({ name: "whatsapp.auth" })
  .derive(async ({ request }) => {
    // Prefer WorkOS session; fall back to API key
    const workosUser = await getWorkOSSession(request)
    if (workosUser) {
      const platformRole = await getPlatformRoleForUser(workosUser)
      return {
        whatsappAuth: {
          type: "workos" as const,
          userId: workosUser.id,
          email: workosUser.email ?? null,
          organizationId: null, // caller must also provide orgId in request body/params
          tenantRole: null,
          platformRole,
        } satisfies WorkOSScope,
      }
    }

    // Fall back to API key
    const bearerToken = extractBearerToken(request)
    if (bearerToken) {
      // Exclude WorkOS session tokens (already checked above)
      if (bearerToken.startsWith("wos_")) {
        return { whatsappAuth: null satisfies WhatsAppAuthContext | null }
      }
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("cf-connecting-ip")?.trim() ??
        null
      const apiKeyScope = await resolveApiKey(bearerToken, clientIp ?? undefined)
      if (apiKeyScope) {
        return { whatsappAuth: apiKeyScope satisfies WhatsAppAuthContext }
      }
    }

    return { whatsappAuth: null satisfies WhatsAppAuthContext | null }
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

// ─── Guard decorators ─────────────────────────────────────────────────────────

 
type GuardHandler = (ctx: any) => Promise<unknown>

 
type GuardedRoute = (ctx: any) => Promise<unknown>

/**
 * Guard route: caller MUST have an authenticated WorkOS session.
 * Use on routes that should only be accessible via browser UI (not API keys).
 */
export const guardWorkOSSession = (
  route: GuardedRoute,
  guardName = "requireWorkOSSession"
): GuardedRoute =>
  async (ctx) => {
    const auth = ctx.whatsappAuth
    if (!auth || !requireWorkOSSession(auth)) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN", message: `${guardName} failed — WorkOS session required.` }
    }
    return route(ctx)
  }

/**
 * Guard route: caller MUST have a valid API key.
 * Use on routes that should only be accessible programmatically.
 */
export const guardApiKey = (
  route: GuardedRoute,
  guardName = "requireApiKey"
): GuardedRoute =>
  async (ctx) => {
    const auth = ctx.whatsappAuth
    if (!auth || !requireApiKey(auth)) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN", message: `${guardName} failed — API key required.` }
    }
    return route(ctx)
  }

/**
 * Guard route: caller MUST have super_admin platform role.
 */
export const guardSuperAdmin = (
  route: GuardedRoute,
  guardName = "requireSuperAdmin"
): GuardedRoute =>
  async (ctx) => {
    const auth = ctx.whatsappAuth
    if (!auth || !requireSuperAdmin(auth)) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN", message: `${guardName} failed — super_admin role required.` }
    }
    return route(ctx)
  }

/**
 * Guard route: caller MUST have at least admin tenant role or super_admin.
 */
export const guardTenantAdmin = (
  route: GuardedRoute,
  guardName = "requireTenantAdmin"
): GuardedRoute =>
  async (ctx) => {
    const auth = ctx.whatsappAuth
    if (!auth || !requireTenantAdmin(auth)) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN", message: `${guardName} failed — tenant admin role required.` }
    }
    return route(ctx)
  }

/**
 * Guard route: caller MUST have at least tenant membership.
 */
export const guardTenantMember = (
  route: GuardedRoute,
  guardName = "requireTenantMember"
): GuardedRoute =>
  async (ctx) => {
    const auth = ctx.whatsappAuth
    if (!auth || !requireTenantMember(auth)) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN", message: `${guardName} failed — tenant member role required.` }
    }
    return route(ctx)
  }

// ─── API Key management ────────────────────────────────────────────────────────

/**
 * Create a new API key — generates hash, stores in DB, returns the raw key (shown once only).
 * Only super_admin can create API keys.
 */
export async function createApiKey(input: {
  name: string
  environment: ApiKeyEnvironment
  scopes: string[]
  expiresAt?: Date
  createdBy: string
}): Promise<{ rawKey: string; keyHash: string }> {
  // Generate a random 32-byte raw key, base64url-encoded
  const rawBytes = new Uint8Array(32)
  crypto.getRandomValues(rawBytes)
  const prefix = input.environment === "SANDBOX" ? "test_" : "live_"
  const rawKey = prefix + Buffer.from(rawBytes).toString("base64url")

  const keyHash = await hashApiKey(rawKey.slice(prefix.length), API_KEY_HASH_SALT())

  const apiKey = await prisma.apiKey.create({
    data: {
      name: input.name,
      keyHash,
      environment: input.environment,
      scopes: input.scopes,
      expiresAt: input.expiresAt ?? null,
      active: true,
      createdBy: input.createdBy,
      lastUsedAt: null,
      lastUsedIp: null,
    },
  })

  return { rawKey, keyHash }
}

/**
 * Revoke (deactivate) an API key by ID.
 * Only super_admin can revoke API keys.
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { active: false },
  })
}

/**
 * List all API keys for a given environment (no raw keys returned).
 */
export async function listApiKeys(environment?: "SANDBOX" | "LIVE") {
  return prisma.apiKey.findMany({
    where: environment ? { environment } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      environment: true,
      scopes: true,
      expiresAt: true,
      active: true,
      lastUsedAt: true,
      lastUsedIp: true,
      createdBy: true,
      createdAt: true,
      // keyHash intentionally excluded — never exposed
    },
  })
}