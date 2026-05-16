import { Elysia } from "elysia"
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import { isTenantApiError } from "@/modules/tenants/api/tenants.errors"
import { requireTenantActor } from "@/modules/tenants/api/tenants.guards"
import { bootstrapCreatePayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type {
  TenantBootstrapCreateResponse,
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

export const tenantsBootstrapRoutes = new Elysia()
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
          await deleteTenantOrganization(organization.id).catch(() => null)
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
        } catch {
          await deleteTenantOrganization(organization.id).catch(() => null)
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
