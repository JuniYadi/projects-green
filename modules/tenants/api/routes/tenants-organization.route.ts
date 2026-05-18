import { Elysia } from "elysia"
import {
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import {
  isTenantApiError,
  type RouteSet,
  toNotFoundError,
  toPolicyError,
} from "@/modules/tenants/api/tenants.errors"
import {
  organizationDeletePayloadSchema,
  organizationUpdatePayloadSchema,
} from "@/modules/tenants/api/tenants.schema"
import type {
  TenantApiError,
  TenantOrganizationDeleteResponse,
  TenantOrganizationResponse,
  TenantOrganizationUpdateResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import type { TenantActorContext } from "@/modules/tenants/api/tenants.guards"
import {
  deleteTenantOrganization,
  getTenantOrganizationById,
  updateTenantOrganization,
} from "@/modules/tenants/services/tenant-workos.service"
import {
  canManageTenant,
  canTransferOwnership,
} from "@/modules/tenants/tenant-policy"

type TenantsOrganizationRouteDeps = {
  requireTenantActor: (
    set: RouteSet
  ) => Promise<TenantActorContext | TenantApiError>
  ensureTenantContextAccess: (
    orgId: string,
    actor: TenantActorContext,
    set: RouteSet
  ) => true | TenantApiError | Promise<true | TenantApiError>
  getTenantOrganizationById: typeof getTenantOrganizationById
  updateTenantOrganization: typeof updateTenantOrganization
  deleteTenantOrganization: typeof deleteTenantOrganization
  canManageTenant: typeof canManageTenant
  canTransferOwnership: typeof canTransferOwnership
}

const defaultRequireTenantActor: TenantsOrganizationRouteDeps["requireTenantActor"] =
  async (set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.requireTenantActor(set)
  }

const defaultEnsureTenantContextAccess: TenantsOrganizationRouteDeps["ensureTenantContextAccess"] =
  async (orgId, actor, set) => {
    const guards = await import("@/modules/tenants/api/tenants.guards")
    return guards.ensureTenantContextAccess(orgId, actor, set)
  }

const defaultTenantsOrganizationRouteDeps: TenantsOrganizationRouteDeps = {
  requireTenantActor: defaultRequireTenantActor,
  ensureTenantContextAccess: defaultEnsureTenantContextAccess,
  getTenantOrganizationById,
  updateTenantOrganization,
  deleteTenantOrganization,
  canManageTenant,
  canTransferOwnership,
}

export const createTenantsOrganizationRoutes = (
  deps: Partial<TenantsOrganizationRouteDeps> = {}
) => {
  const {
    requireTenantActor,
    ensureTenantContextAccess,
    getTenantOrganizationById,
    updateTenantOrganization,
    deleteTenantOrganization,
    canManageTenant,
    canTransferOwnership,
  } = {
    ...defaultTenantsOrganizationRouteDeps,
    ...deps,
  }

  return new Elysia()
  .get("/tenants/:orgId/organization", async ({ params, set }) => {
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

    if (
      !canManageTenant({
        platformRole: actorResult.platformRole,
        tenantRole: actorResult.tenantRole,
      })
    ) {
      return toPolicyError(
        set,
        "TENANT_MANAGE_REQUIRED",
        "You do not have permission to view organization settings."
      )
    }

    const organization = await getTenantOrganizationById(params.orgId)
    if (!organization) {
      return toNotFoundError(set, "Organization not found.")
    }

    return {
      ok: true,
      orgId: params.orgId,
      organization,
    } satisfies TenantOrganizationResponse
  })
  .post(
    "/tenants/:orgId/organization/update",
    async ({ params, body, set }) => {
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

      if (
        !canManageTenant({
          platformRole: actorResult.platformRole,
          tenantRole: actorResult.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "TENANT_MANAGE_REQUIRED",
          "You do not have permission to update organization settings."
        )
      }

      try {
        const organization = await updateTenantOrganization({
          organizationId: params.orgId,
          name: body.name,
          metadata: body.metadata,
        })

        return {
          ok: true,
          organization,
        } satisfies TenantOrganizationUpdateResponse
      } catch (error) {
        if (error instanceof UnprocessableEntityException) {
          set.status = 422

          return {
            ok: false,
            error: "ORGANIZATION_UPDATE_INVALID",
            message: error.message,
          }
        }

        if (error instanceof NotFoundException) {
          set.status = 404

          return {
            ok: false,
            error: "ORGANIZATION_NOT_FOUND",
            message: "The organization could not be found.",
          }
        }

        set.status = 500

        return {
          ok: false,
          error: "ORGANIZATION_UPDATE_FAILED",
          message: "Unable to update organization settings right now.",
        }
      }
    },
    {
      body: organizationUpdatePayloadSchema,
    }
  )
  .post(
    "/tenants/:orgId/organization/delete",
    async ({ params, body, set }) => {
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

      if (
        !canTransferOwnership({
          platformRole: actorResult.platformRole,
          tenantRole: actorResult.tenantRole,
        })
      ) {
        return toPolicyError(
          set,
          "ORGANIZATION_DELETE_FORBIDDEN",
          "Only tenant owners or super admins can delete the organization."
        )
      }

      const organization = await getTenantOrganizationById(params.orgId)
      if (!organization) {
        return toNotFoundError(set, "Organization not found.")
      }

      if (body.confirmOrganizationId.trim() !== params.orgId) {
        set.status = 422

        return {
          ok: false,
          error: "ORGANIZATION_DELETE_CONFIRMATION_MISMATCH",
          message:
            "Confirmation does not match the requested organization. Deletion cancelled.",
        }
      }

      if (body.confirmOrganizationName.trim() !== organization.name.trim()) {
        set.status = 422

        return {
          ok: false,
          error: "ORGANIZATION_DELETE_CONFIRMATION_MISMATCH",
          message:
            "Confirmation does not match the organization name. Deletion cancelled.",
        }
      }

      try {
        await deleteTenantOrganization(params.orgId)
      } catch (error) {
        if (error instanceof NotFoundException) {
          set.status = 404

          return {
            ok: false,
            error: "ORGANIZATION_NOT_FOUND",
            message: "The organization could not be found.",
          }
        }

        if (error instanceof UnprocessableEntityException) {
          set.status = 422

          return {
            ok: false,
            error: "ORGANIZATION_DELETE_INVALID",
            message: error.message,
          }
        }

        set.status = 500

        return {
          ok: false,
          error: "ORGANIZATION_DELETE_FAILED",
          message: "Unable to delete organization right now.",
        }
      }

      return {
        ok: true,
        organizationDeleted: true,
        organizationId: params.orgId,
      } satisfies TenantOrganizationDeleteResponse
    },
    {
      body: organizationDeletePayloadSchema,
    }
  )
}

export const tenantsOrganizationRoutes = createTenantsOrganizationRoutes()
