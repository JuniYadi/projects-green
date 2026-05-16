import { Elysia } from "elysia"

import { isTenantApiError } from "@/modules/tenants/api/tenants.errors"
import {
  ensureTenantContextAccess,
  requireTenantActor,
} from "@/modules/tenants/api/tenants.guards"
import type { TenantAuthorizationResponse } from "@/modules/tenants/contracts/tenant-api.contract"
import { buildAllowedActions } from "@/modules/tenants/tenant-policy"

export const tenantsAuthorizationRoutes = new Elysia().get(
  "/tenants/:orgId/authorization",
  async ({ params, set }) => {
    const actorResult = await requireTenantActor(set)
    if (isTenantApiError(actorResult)) {
      return actorResult
    }

    const hasContextAccess = ensureTenantContextAccess(
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
  }
)
