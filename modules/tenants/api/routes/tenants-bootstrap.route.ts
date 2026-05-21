import { Elysia } from "elysia"

import {
  isTenantApiError,
  type RouteSet,
} from "@/modules/tenants/api/tenants.errors"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"
import { bootstrapCreatePayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type {
  TenantApiError,
  TenantBootstrapResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import {
  createTenantOrganizationWithCreator,
  defaultTenantCreateOrganizationDeps,
  type TenantCreateOrganizationDeps,
} from "@/modules/tenants/api/routes/tenants-create-organization.shared"

type TenantsBootstrapRouteDeps = TenantCreateOrganizationDeps & {
  requireTenantActor: (
    set: RouteSet
  ) => Promise<TenantActorContext | TenantApiError>
}

const defaultRequireTenantActor: TenantsBootstrapRouteDeps["requireTenantActor"] =
  async (set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.requireTenantActor(set)
  }

const defaultTenantsBootstrapRouteDeps: TenantsBootstrapRouteDeps = {
  requireTenantActor: defaultRequireTenantActor,
  ...defaultTenantCreateOrganizationDeps,
}

export const createTenantsBootstrapRoutes = (
  deps: Partial<TenantsBootstrapRouteDeps> = {}
) => {
  const {
    requireTenantActor,
    listTenantBootstrapMembershipsForUser,
    createTenantOrganization,
    hasBootstrapCreatorRole,
    createTenantMembership,
    deleteTenantOrganization,
    getBootstrapCreatorRoleSlug,
  } = {
    ...defaultTenantsBootstrapRouteDeps,
    ...deps,
  }

  return new Elysia()
    .get("/tenants/bootstrap", async ({ set }) => {
      const actorResult = await requireTenantActor(set)
      if (isTenantApiError(actorResult)) {
        return actorResult
      }

      const memberships = await listTenantBootstrapMembershipsForUser(
        actorResult.userId
      )

      return {
        ok: true,
        currentOrganizationId: actorResult.organizationId,
        memberships,
      } satisfies TenantBootstrapResponse
    })
    .post(
      "/tenants/bootstrap/create",
      async ({ body, set }) => {
        const actorResult = await requireTenantActor(set)
        if (isTenantApiError(actorResult)) {
          return actorResult
        }

        if (actorResult.organizationId) {
          set.status = 409

          return {
            ok: false,
            error: "ORGANIZATION_CONTEXT_EXISTS",
            message:
              "You already have an active organization context in this session.",
          }
        }

        const existingMemberships = await listTenantBootstrapMembershipsForUser(
          actorResult.userId
        )
        const activeMembership = existingMemberships.find(
          (membership) => membership.status === "active"
        )

        if (activeMembership) {
          set.status = 409

          return {
            ok: false,
            error: "ACTIVE_MEMBERSHIP_EXISTS",
            message:
              "You already belong to an organization. Select and join it instead.",
          }
        }

        return createTenantOrganizationWithCreator({
          set,
          userId: actorResult.userId,
          organizationName: body.name,
          deps: {
            listTenantBootstrapMembershipsForUser,
            createTenantOrganization,
            hasBootstrapCreatorRole,
            createTenantMembership,
            deleteTenantOrganization,
            getBootstrapCreatorRoleSlug,
          },
        })
      },
      {
        body: bootstrapCreatePayloadSchema,
      }
    )
}

export const tenantsBootstrapRoutes = createTenantsBootstrapRoutes()
