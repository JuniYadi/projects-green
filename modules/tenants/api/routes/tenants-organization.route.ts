import { Elysia } from "elysia"
import {
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import {
  isTenantApiError,
  toNotFoundError,
  toPolicyError,
} from "@/modules/tenants/api/tenants.errors"
import {
  ensureTenantContextAccess,
  requireTenantActor,
} from "@/modules/tenants/api/tenants.guards"
import {
  organizationDeletePayloadSchema,
  organizationUpdatePayloadSchema,
} from "@/modules/tenants/api/tenants.schema"
import type {
  TenantOrganizationDeleteResponse,
  TenantOrganizationResponse,
  TenantOrganizationUpdateResponse,
} from "@/modules/tenants/contracts/tenant-api.contract"
import {
  deleteTenantOrganization,
  getTenantOrganizationById,
  updateTenantOrganization,
} from "@/modules/tenants/services/tenant-workos.service"
import {
  canManageTenant,
  canTransferOwnership,
} from "@/modules/tenants/tenant-policy"

export const tenantsOrganizationRoutes = new Elysia()
  .get("/tenants/:orgId/organization", async ({ params, set }) => {
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

      const hasContextAccess = ensureTenantContextAccess(
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
          name: body.name.trim(),
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

      const hasContextAccess = ensureTenantContextAccess(
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
          "Only owners can delete the organization."
        )
      }

      const organization = await getTenantOrganizationById(params.orgId)
      if (!organization) {
        return toNotFoundError(set, "Organization not found.")
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

      await deleteTenantOrganization(params.orgId)

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
