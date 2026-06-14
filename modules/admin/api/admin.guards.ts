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

export type RouteSet = { status?: number | string }

export type AdminApiError = {
  ok: false
  error: string
  message: string
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
export const adminAuthGuard = new Elysia({ name: "admin-auth-guard" })
  .onBeforeHandle({ as: "scoped" }, async ({ set }) => {
    const actor = await requireSuperAdmin(set as RouteSet)

    if (!actor.ok) {
      const status =
        typeof set.status === "number" ? set.status : 403

      return new Response(JSON.stringify(actor), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    }
  })