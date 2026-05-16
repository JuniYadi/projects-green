import { Elysia } from "elysia"

import {
  isTenantApiError,
  toPolicyError,
} from "@/modules/tenants/api/tenants.errors"
import {
  ensureTenantContextAccess,
  requireTenantActor,
} from "@/modules/tenants/api/tenants.guards"
import { transferOwnershipPayloadSchema } from "@/modules/tenants/api/tenants.schema"
import type { TenantOwnershipTransferResponse } from "@/modules/tenants/contracts/tenant-api.contract"
import {
  getTenantMembershipById,
  listTenantMemberships,
  updateTenantMembershipRole,
} from "@/modules/tenants/services/tenant-workos.service"
import { canTransferOwnership } from "@/modules/tenants/tenant-policy"

export const tenantsOwnershipRoutes = new Elysia().post(
  "/tenants/:orgId/ownership/transfer",
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
        "OWNERSHIP_TRANSFER_FORBIDDEN",
        "Only owner can transfer tenant ownership."
      )
    }

    const targetMembership = await getTenantMembershipById(
      body.newOwnerMembershipId
    )

    if (targetMembership.organizationId !== params.orgId) {
      return toPolicyError(
        set,
        "MEMBERSHIP_ORG_MISMATCH",
        "Target membership does not belong to the requested tenant."
      )
    }

    const promoted = await updateTenantMembershipRole(
      targetMembership.id,
      "owner"
    )

    if (
      actorResult.platformRole !== "super_admin" &&
      actorResult.userId !== targetMembership.userId
    ) {
      const memberships = await listTenantMemberships(params.orgId)
      const actorMembership = memberships.find(
        (membership) => membership.userId === actorResult.userId
      )

      if (actorMembership?.role === "owner") {
        await updateTenantMembershipRole(actorMembership.id, "admin")
      }
    }

    return {
      ok: true,
      ownershipTransferred: true,
      membership: promoted,
    } satisfies TenantOwnershipTransferResponse
  },
  {
    body: transferOwnershipPayloadSchema,
  }
)
