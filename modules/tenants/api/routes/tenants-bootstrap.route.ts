import { Elysia } from "elysia"
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import {
  isTenantApiError,
  type RouteSet,
} from "@/modules/tenants/api/tenants.errors"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"
import { bootstrapCreatePayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type {
  TenantApiError,
  TenantBootstrapCreateResponse,
  TenantBootstrapMembership,
  TenantBootstrapResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import {
  createTenantMembership,
  createTenantOrganization,
  deleteTenantOrganization,
  getBootstrapCreatorRoleSlug,
  hasBootstrapCreatorRole,
  listTenantBootstrapMembershipsForUser,
} from "@/modules/tenants/services/tenant-workos.service"
import { normalizeTenantRole } from "@/modules/tenants/tenant-policy"

type TenantsBootstrapRouteDeps = {
  requireTenantActor: (
    set: RouteSet
  ) => Promise<TenantActorContext | TenantApiError>
  listTenantBootstrapMembershipsForUser: typeof listTenantBootstrapMembershipsForUser
  createTenantOrganization: typeof createTenantOrganization
  hasBootstrapCreatorRole: typeof hasBootstrapCreatorRole
  createTenantMembership: typeof createTenantMembership
  deleteTenantOrganization: typeof deleteTenantOrganization
  getBootstrapCreatorRoleSlug: typeof getBootstrapCreatorRoleSlug
}

const defaultRequireTenantActor: TenantsBootstrapRouteDeps["requireTenantActor"] =
  async (set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.requireTenantActor(set)
  }

const defaultTenantsBootstrapRouteDeps: TenantsBootstrapRouteDeps = {
  requireTenantActor: defaultRequireTenantActor,
  listTenantBootstrapMembershipsForUser,
  createTenantOrganization,
  hasBootstrapCreatorRole,
  createTenantMembership,
  deleteTenantOrganization,
  getBootstrapCreatorRoleSlug,
}

const CREATOR_MEMBERSHIP_VERIFICATION_ATTEMPTS = 4
const CREATOR_MEMBERSHIP_RETRY_DELAY_MS = 120

const delay = async (milliseconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const verifyCreatorMembershipRole = async (params: {
  listTenantBootstrapMembershipsForUser: (
    userId: string
  ) => Promise<TenantBootstrapMembership[]>
  organizationId: string
  userId: string
}) => {
  for (
    let attempt = 0;
    attempt < CREATOR_MEMBERSHIP_VERIFICATION_ATTEMPTS;
    attempt += 1
  ) {
    const memberships = await params.listTenantBootstrapMembershipsForUser(
      params.userId
    )
    const creatorMembership = memberships.find((membership) => {
      return (
        membership.organizationId === params.organizationId &&
        membership.status === "active"
      )
    })

    const creatorRole = normalizeTenantRole(creatorMembership?.roleSlug)
    if (creatorRole) {
      return true
    }

    if (attempt < CREATOR_MEMBERSHIP_VERIFICATION_ATTEMPTS - 1) {
      await delay(CREATOR_MEMBERSHIP_RETRY_DELAY_MS)
    }
  }

  return false
}

const rollbackOrganizationCreation = async (
  deleteTenantOrganization: TenantsBootstrapRouteDeps["deleteTenantOrganization"],
  organizationId: string
) => {
  try {
    await deleteTenantOrganization(organizationId)
    return true
  } catch {
    return false
  }
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

        try {
          const organization = await createTenantOrganization(body.name.trim())

          const creatorRoleIsAvailable = await hasBootstrapCreatorRole(
            organization.id
          )

          if (!creatorRoleIsAvailable) {
            await rollbackOrganizationCreation(
              deleteTenantOrganization,
              organization.id
            )
            set.status = 422

            return {
              ok: false,
              error: "CREATOR_ROLE_MISSING",
              message:
                "Required WorkOS role 'user_owner' is missing. Run `bun run seed:workos-roles` and retry.",
            }
          }

          try {
            await createTenantMembership({
              organizationId: organization.id,
              userId: actorResult.userId,
              roleSlug: getBootstrapCreatorRoleSlug(),
            })

            const creatorHasValidRole = await verifyCreatorMembershipRole({
              listTenantBootstrapMembershipsForUser,
              organizationId: organization.id,
              userId: actorResult.userId,
            })

            if (!creatorHasValidRole) {
              await rollbackOrganizationCreation(
                deleteTenantOrganization,
                organization.id
              )
              set.status = 500

              return {
                ok: false,
                error: "ORGANIZATION_BOOTSTRAP_FAILED",
                message: "Unable to create organization right now.",
              }
            }
          } catch {
            await rollbackOrganizationCreation(
              deleteTenantOrganization,
              organization.id
            )
            set.status = 500

            return {
              ok: false,
              error: "ORGANIZATION_BOOTSTRAP_FAILED",
              message: "Unable to create organization right now.",
            }
          }

          set.status = 201

          return {
            ok: true,
            organizationId: organization.id,
          } satisfies TenantBootstrapCreateResponse
        } catch (error) {
          if (error instanceof ConflictException) {
            set.status = 409

            return {
              ok: false,
              error: "ORGANIZATION_CONFLICT",
              message:
                "Organization bootstrap could not be completed due to a conflict.",
            }
          }

          if (error instanceof UnprocessableEntityException) {
            set.status = 422

            return {
              ok: false,
              error: "ORGANIZATION_BOOTSTRAP_INVALID",
              message: error.message,
            }
          }

          if (error instanceof NotFoundException) {
            set.status = 404

            return {
              ok: false,
              error: "ORGANIZATION_BOOTSTRAP_NOT_FOUND",
              message:
                "Organization bootstrap failed because a required WorkOS resource was not found.",
            }
          }

          set.status = 500

          return {
            ok: false,
            error: "ORGANIZATION_BOOTSTRAP_FAILED",
            message: "Unable to create organization right now.",
          }
        }
      },
      {
        body: bootstrapCreatePayloadSchema,
      }
    )
}

export const tenantsBootstrapRoutes = createTenantsBootstrapRoutes()
