import { Elysia } from "elysia"

import { isTenantApiError, type RouteSet } from "@/modules/tenants/api/tenants.errors"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"
import type {
  TenantApiError,
  TenantAuthorizationResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import { buildAllowedActions } from "@/modules/tenants/tenant-policy"

type TenantsAuthorizationRouteDeps = {
  requireTenantActor: (
    set: RouteSet
  ) => Promise<TenantActorContext | TenantApiError>
  ensureTenantContextAccess: (
    orgId: string,
    actor: TenantActorContext,
    set: RouteSet
  ) => true | TenantApiError | Promise<true | TenantApiError>
  buildAllowedActions: typeof buildAllowedActions
}

const defaultRequireTenantActor: TenantsAuthorizationRouteDeps["requireTenantActor"] =
  async (set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.requireTenantActor(set)
  }

const defaultEnsureTenantContextAccess: TenantsAuthorizationRouteDeps["ensureTenantContextAccess"] =
  async (orgId, actor, set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.ensureTenantContextAccess(orgId, actor, set)
  }

const defaultTenantsAuthorizationRouteDeps: TenantsAuthorizationRouteDeps = {
  requireTenantActor: defaultRequireTenantActor,
  ensureTenantContextAccess: defaultEnsureTenantContextAccess,
  buildAllowedActions,
}

export const createTenantsAuthorizationRoutes = (
  deps: Partial<TenantsAuthorizationRouteDeps> = {}
) => {
  const { requireTenantActor, ensureTenantContextAccess, buildAllowedActions } =
    {
      ...defaultTenantsAuthorizationRouteDeps,
      ...deps,
    }

  return new Elysia().get("/tenants/:orgId/authorization", async ({ params, set }) => {
    const actorResult = await requireTenantActor(set)
    if (isTenantApiError(actorResult)) {
      return actorResult
    }

    const hasContextAccess = await ensureTenantContextAccess(
      params.orgId,
      actorResult,
      set
    )
    if (hasContextAccess !== true) {
      return hasContextAccess
    }

    return {
      ok: true,
      orgId: params.orgId,
      effectiveGlobalRole: actorResult.platformRole,
      effectiveTenantRole: actorResult.tenantRole,
      allowedActions: buildAllowedActions({
        platformRole: actorResult.platformRole,
        tenantRole: actorResult.tenantRole,
      }),
    } satisfies TenantAuthorizationResponse
  })
}

export const tenantsAuthorizationRoutes = createTenantsAuthorizationRoutes()
export type App = ReturnType<typeof createTenantsAuthorizationRoutes>
