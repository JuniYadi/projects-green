import { Elysia } from "elysia"

import {
  isTenantApiError,
  type RouteSet,
} from "@/modules/tenants/api/tenants.errors"
import { bootstrapCreatePayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"
import type { TenantApiError } from "@/modules/tenants/contracts/tenant-api.contract"
import {
  createTenantOrganizationWithCreator,
  defaultTenantCreateOrganizationDeps,
  type TenantCreateOrganizationDeps,
} from "@/modules/tenants/api/routes/tenants-create-organization.shared"

type TenantsOrganizationsRouteDeps = TenantCreateOrganizationDeps & {
  requireTenantActor: (
    set: RouteSet
  ) => Promise<TenantActorContext | TenantApiError>
}

const defaultRequireTenantActor: TenantsOrganizationsRouteDeps["requireTenantActor"] =
  async (set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.requireTenantActor(set)
  }

const defaultTenantsOrganizationsRouteDeps: TenantsOrganizationsRouteDeps = {
  requireTenantActor: defaultRequireTenantActor,
  ...defaultTenantCreateOrganizationDeps,
}

export const createTenantsOrganizationsRoutes = (
  deps: Partial<TenantsOrganizationsRouteDeps> = {}
) => {
  const {
    requireTenantActor,
    createTenantOrganization,
    hasBootstrapCreatorRole,
    createTenantMembership,
    deleteTenantOrganization,
    getBootstrapCreatorRoleSlug,
    listTenantBootstrapMembershipsForUser,
  } = {
    ...defaultTenantsOrganizationsRouteDeps,
    ...deps,
  }

  return new Elysia().post(
    "/tenants/organizations/create",
    async ({ body, set }) => {
      const actorResult = await requireTenantActor(set)
      if (isTenantApiError(actorResult)) {
        return actorResult
      }

      return createTenantOrganizationWithCreator({
        set,
        userId: actorResult.userId,
        organizationName: body.name,
        deps: {
          createTenantOrganization,
          hasBootstrapCreatorRole,
          createTenantMembership,
          deleteTenantOrganization,
          getBootstrapCreatorRoleSlug,
          listTenantBootstrapMembershipsForUser,
        },
      })
    },
    {
      body: bootstrapCreatePayloadSchema,
    }
  )
}

export type App = ReturnType<typeof createTenantsOrganizationsRoutes>

export const tenantsOrganizationsRoutes = createTenantsOrganizationsRoutes()
