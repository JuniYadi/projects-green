import type { AuthContext, WorkOSScope, PlatformScope } from "./types"
import type { OrgRole } from "./org-role"

type GuardHandler = (ctx: any) => Promise<unknown>
type GuardedRoute = (ctx: any) => Promise<unknown>

function isSuperAdmin(ctx: WorkOSScope): boolean {
  return ctx.platformRole === "super_admin"
}

function hasOrgMembership(ctx: WorkOSScope): boolean {
  return ctx.organizationId !== null
}

function roleAtLeast(
  userRole: OrgRole | null,
  required: OrgRole
): boolean {
  if (!userRole) return false
  const hierarchy: OrgRole[] = ["member", "admin", "owner"]
  return hierarchy.indexOf(userRole) >= hierarchy.indexOf(required)
}

function getActionMessage(
  required: OrgRole,
  current: OrgRole | null,
  isApi: boolean
): string {
  if (isApi) {
    return "API keys do not support org-scoped access. Use a WorkOS session."
  }
  if (!current) {
    return "You need to join an organization first."
  }
  if (required === "admin" && current === "member") {
    return "Request an upgrade from your organization owner."
  }
  if (required === "owner" && current === "member") {
    return "Request ownership transfer from your organization owner."
  }
  if (required === "owner" && current === "admin") {
    return "Request ownership transfer from your organization owner."
  }
  return "Request an upgrade from your organization owner."
}

export const guardOrgRead = (route: GuardedRoute): GuardedRoute =>
  async (ctx) => {
    const auth: AuthContext = ctx.whatsappAuth
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Authentication required." }
    }

    // Platform API keys pass read access — routes are responsible for
    // filtering results by organizationId when needed.
    if (auth.type === "platform") {
      return route(ctx)
    }

    if (!hasOrgMembership(auth)) {
      ctx.set.status = 403
      return {
        ok: false,
        error: "FORBIDDEN",
        message: "Access restricted",
        required: "member",
        current: null,
        action: "You need to join an organization first.",
      }
    }

    return route(ctx)
  }

export const guardOrgWrite = (route: GuardedRoute): GuardedRoute =>
  async (ctx) => {
    const auth: AuthContext = ctx.whatsappAuth
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Authentication required." }
    }

    // Platform API keys need platform:admin or * scope for write access.
    if (auth.type === "platform") {
      const hasWriteScope =
        Array.isArray(auth.scopes) &&
        (auth.scopes.includes("platform:admin") || auth.scopes.includes("*"))
      if (!hasWriteScope) {
        ctx.set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Access restricted",
          required: "admin",
          current: null,
          action: "This operation requires a platform:admin scoped API key.",
        }
      }
      return route(ctx)
    }

    if (isSuperAdmin(auth)) return route(ctx)

    if (!hasOrgMembership(auth)) {
      ctx.set.status = 403
      return {
        ok: false,
        error: "FORBIDDEN",
        message: "Access restricted",
        required: "admin",
        current: null,
        action: "You need to join an organization first.",
      }
    }

    if (!roleAtLeast(auth.orgRole, "admin")) {
      ctx.set.status = 403
      return {
        ok: false,
        error: "FORBIDDEN",
        message: "Access restricted",
        required: "admin",
        current: auth.orgRole,
        action: getActionMessage("admin", auth.orgRole, false),
      }
    }

    return route(ctx)
  }

export const guardOrgFull = (route: GuardedRoute): GuardedRoute =>
  async (ctx) => {
    const auth: AuthContext = ctx.whatsappAuth
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Authentication required." }
    }

    // Platform API keys need platform:admin or wildcard scope for full access.
    if (auth.type === "platform") {
      const hasAdminScope =
        Array.isArray(auth.scopes) &&
        (auth.scopes.includes("platform:admin") || auth.scopes.includes("*"))
      if (!hasAdminScope) {
        ctx.set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Access restricted",
          required: "owner",
          current: null,
          action: "This operation requires a platform:admin scoped API key.",
        }
      }
      return route(ctx)
    }

    if (isSuperAdmin(auth)) return route(ctx)

    if (!hasOrgMembership(auth)) {
      ctx.set.status = 403
      return {
        ok: false,
        error: "FORBIDDEN",
        message: "Access restricted",
        required: "owner",
        current: null,
        action: "You need to join an organization first.",
      }
    }

    if (!roleAtLeast(auth.orgRole, "owner")) {
      ctx.set.status = 403
      return {
        ok: false,
        error: "FORBIDDEN",
        message: "Access restricted",
        required: "owner",
        current: auth.orgRole,
        action: getActionMessage("owner", auth.orgRole, false),
      }
    }

    return route(ctx)
  }

export const guardSuperAdmin = (route: GuardedRoute): GuardedRoute =>
  async (ctx) => {
    const auth: AuthContext = ctx.whatsappAuth
    if (!auth) {
      ctx.set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Authentication required." }
    }

    const isAdmin =
      (auth.type === "platform" &&
        Array.isArray(auth.scopes) &&
        (auth.scopes.includes("platform:admin") || auth.scopes.includes("*"))) ||
      (auth.type === "workos" && isSuperAdmin(auth))

    if (!isAdmin) {
      ctx.set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "super_admin role required." }
    }

    return route(ctx)
  }
