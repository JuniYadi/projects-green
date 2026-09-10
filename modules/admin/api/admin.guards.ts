import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"

import {
  getPlatformRoleForUser,
  type PlatformAccessRole,
} from "@/lib/platform-role"

/**
 * ADMIN ROUTE AUTH MANIFEST
 *
 * Routes using requireSuperAdmin / adminAuthGuard:
 *   admin/api/routes/admin-organizations.route.ts
 *   admin/api/routes/admin-invitations.route.ts
 *   github/api/github-event-log.route.ts
 *   whatsapp/devices/api/admin-devices.route.ts
 *   framework-detection/api/detector-admin.route.ts
 *   payment/api/admin-bank.route.ts (GET fixed in P0.1)
 *
 * Routes still using inline withAuth() — MIGRATION CANDIDATES:
 *   payment/api/admin-gateway.route.ts
 *   payment/api/admin-confirmation.route.ts
 *   payment/api/admin-currency.route.ts
 *   payment/api/admin-settings.route.ts
 *
 * Routes using custom isAdmin deps pattern:
 *   billing/api/admin/members.route.ts
 *   billing/api/admin/subscriptions.route.ts
 *   billing/api/admin/invoices-list.route.ts
 *   billing/api/admin/adjustments.route.ts
 *
 * TODO: Migrate all migration-candidate routes to adminAuthGuard
 * in follow-up PRs. Each migration is small and self-contained.
 */

export type AdminActorContext = {
  ok: true
  userId: string
  platformRole: PlatformAccessRole
}

export type ScopedTenantAdminActorContext = {
  ok: true
  userId: string
  platformRole: PlatformAccessRole
  organizationId: string
  isSuperAdmin: boolean
  role?: string | null
}

export type RouteSet = { status?: number | string }

export type AdminApiError = {
  ok: false
  error: string
  message: string
  fieldErrors?: Record<string, string[]>
  policyCode?: string
}

export const toUnauthorizedError = (set: RouteSet): AdminApiError => {
  set.status = 401

  return {
    ok: false,
    error: "UNAUTHORIZED",
    message: "You must be signed in to perform this action.",
  }
}

export const toForbiddenError = (set: RouteSet): AdminApiError => {
  set.status = 403

  return {
    ok: false,
    error: "FORBIDDEN",
    policyCode: "SUPER_ADMIN_REQUIRED",
    message: "This action requires super admin access.",
  }
}

export const getAdminActorContext =
  async (): Promise<AdminActorContext | null> => {
    const auth = await withAuth()

    if (!auth.user) {
      return null
    }

    const platformRole = await getPlatformRoleForUser({
      id: auth.user.id,
      email: auth.user.email,
    })

    return {
      ok: true as const,
      userId: auth.user.id,
      platformRole,
    }
  }

export const requireSuperAdmin = async (
  set: RouteSet
): Promise<AdminActorContext | AdminApiError> => {
  const actor = await getAdminActorContext()

  if (!actor) {
    return toUnauthorizedError(set)
  }

  if (actor.platformRole !== "super_admin") {
    return toForbiddenError(set)
  }

  return { ok: true, userId: actor.userId, platformRole: actor.platformRole }
}

export type ScopedAdminAuthContext = {
  user: { id: string; email?: string | null } | null
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
}

export const resolveAdminActor = (
  platformRole: PlatformAccessRole,
  orgRole: string | null | undefined
): boolean => {
  if (platformRole === "super_admin") return true
  return orgRole === "admin" || orgRole === "owner"
}

/**
 * Resolve and enforce scoped tenant admin access.
 *
 * Returns a valid ScopedTenantAdminActorContext if:
 * 1. The user is a super_admin (global platform access), OR
 * 2. The user has an active organizationId and an admin/owner role in that organization.
 *
 * If targetOrgId is provided and the caller is not super_admin, it enforces that
 * targetOrgId matches the caller's session organizationId (preventing IDOR).
 */
export const requireScopedTenantAdmin = async (
  set: RouteSet,
  options: {
    targetOrgId?: string | null
    authenticate?: () => Promise<ScopedAdminAuthContext>
  } = {}
): Promise<ScopedTenantAdminActorContext | AdminApiError> => {
  const auth = options.authenticate
    ? await options.authenticate()
    : await withAuth()

  if (!auth.user) {
    return toUnauthorizedError(set)
  }

  const platformRole = await getPlatformRoleForUser({
    id: auth.user.id,
    email: auth.user.email,
  })

  const isSuperAdmin = platformRole === "super_admin"

  if (isSuperAdmin) {
    return {
      ok: true,
      userId: auth.user.id,
      platformRole,
      organizationId: options.targetOrgId || auth.organizationId || "",
      isSuperAdmin: true,
      role: auth.role,
    }
  }

  // Non-super-admin MUST have an organization context
  if (!auth.organizationId) {
    set.status = 403
    return {
      ok: false,
      error: "FORBIDDEN",
      policyCode: "ORGANIZATION_CONTEXT_REQUIRED",
      message: "Organization context required for tenant administrators.",
    }
  }

  // Non-super-admin MUST have admin or owner role in their tenant
  const isAdmin = auth.role === "admin" || auth.role === "owner"
  if (!isAdmin) {
    set.status = 403
    return {
      ok: false,
      error: "FORBIDDEN",
      policyCode: "ADMIN_ROLE_REQUIRED",
      message: "Only administrators can perform this action.",
    }
  }

  // Enforce tenant boundary scoping if a target organization was requested
  if (options.targetOrgId && options.targetOrgId !== auth.organizationId) {
    set.status = 403
    return {
      ok: false,
      error: "FORBIDDEN",
      policyCode: "CROSS_TENANT_ACCESS_DENIED",
      message: "Cannot access resources belonging to another organization.",
    }
  }

  return {
    ok: true,
    userId: auth.user.id,
    platformRole,
    organizationId: auth.organizationId,
    isSuperAdmin: false,
    role: auth.role,
  }
}

/**
 * Elysia plugin that enforces tenant admin authorization.
 */
export const scopedTenantAdminGuard = new Elysia({
  name: "scoped-tenant-admin-guard",
}).onBeforeHandle({ as: "scoped" }, async ({ set }) => {
  const actor = await requireScopedTenantAdmin(set as RouteSet)

  if (!actor.ok) {
    const status = typeof set.status === "number" ? set.status : 403

    return new Response(JSON.stringify(actor), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
})

/**
 * Elysia plugin that enforces super_admin auth on every route.
 *
 * Usage:
 *   const app = new Elysia()
 *     .use(adminAuthGuard)
 *     .get("/admin/foo", () => { ... })
 *
 * Any route registered after `.use(adminAuthGuard)` will automatically
 * return 401 (unauthenticated) or 403 (non-super_admin) before the
 * handler runs. The handler only executes for authenticated
 * super_admin users.
 *
 * Uses `as: "scoped"` so the guard only applies to routes within
 * the consuming Elysia instance — it does not leak to sibling
 * apps composed in the parent.
 *
 * Note: the handler does NOT receive an `actor` value via derive
 * because Elysia 1.4.x does not reliably propagate `derive()` across
 * `.use()` boundaries. Handlers that need the actor context should
 * call `requireSuperAdmin(set)` directly.
 */
export const adminAuthGuard = new Elysia({
  name: "admin-auth-guard",
}).onBeforeHandle({ as: "scoped" }, async ({ set }) => {
  const actor = await requireSuperAdmin(set as RouteSet)

  if (!actor.ok) {
    const status = typeof set.status === "number" ? set.status : 403

    return new Response(JSON.stringify(actor), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
})
