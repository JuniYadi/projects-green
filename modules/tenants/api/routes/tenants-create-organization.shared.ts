import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import type { RouteSet } from "@/modules/tenants/api/tenants.errors"
import type {
  TenantApiError,
  TenantBillingCurrency,
  TenantBootstrapCreateResponse,
  TenantBootstrapMembership,
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

export type TenantCreateOrganizationDeps = {
  listTenantBootstrapMembershipsForUser: typeof listTenantBootstrapMembershipsForUser
  createTenantOrganization: typeof createTenantOrganization
  hasBootstrapCreatorRole: typeof hasBootstrapCreatorRole
  createTenantMembership: typeof createTenantMembership
  deleteTenantOrganization: typeof deleteTenantOrganization
  getBootstrapCreatorRoleSlug: typeof getBootstrapCreatorRoleSlug
}

export const defaultTenantCreateOrganizationDeps: TenantCreateOrganizationDeps =
  {
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

    const normalizedCreatorRole = normalizeTenantRole(
      creatorMembership?.roleSlug
    )
    const rawCreatorRole = creatorMembership?.roleSlug?.trim().toLowerCase()
    if (
      normalizedCreatorRole === "owner" ||
      rawCreatorRole === "bootstrap" ||
      rawCreatorRole === "user_bootstrap"
    ) {
      return true
    }

    if (attempt < CREATOR_MEMBERSHIP_VERIFICATION_ATTEMPTS - 1) {
      await delay(CREATOR_MEMBERSHIP_RETRY_DELAY_MS)
    }
  }

  return false
}

const rollbackOrganizationCreation = async (
  deleteOrganization: TenantCreateOrganizationDeps["deleteTenantOrganization"],
  organizationId: string
) => {
  try {
    await deleteOrganization(organizationId)
    return true
  } catch {
    return false
  }
}

const toRollbackFailedResponse = (
  set: RouteSet,
  organizationId: string
): TenantApiError => {
  set.status = 500
  return {
    ok: false,
    error: "ROLLBACK_FAILED",
    message: `Unable to roll back organization bootstrap for ${organizationId}.`,
  }
}

export const createTenantOrganizationWithCreator = async (params: {
  set: RouteSet
  userId: string
  organizationName: string
  currency?: TenantBillingCurrency
  deps: TenantCreateOrganizationDeps
}): Promise<TenantBootstrapCreateResponse | TenantApiError> => {
  const {
    set,
    userId,
    organizationName,
    currency = "IDR",
    deps: {
      createTenantOrganization,
      hasBootstrapCreatorRole,
      createTenantMembership,
      deleteTenantOrganization,
      getBootstrapCreatorRoleSlug,
      listTenantBootstrapMembershipsForUser,
    },
  } = params

  try {
    const organization = await createTenantOrganization(organizationName.trim())

    const creatorRoleIsAvailable = await hasBootstrapCreatorRole(
      organization.id
    )
    if (!creatorRoleIsAvailable) {
      const rollbackSucceeded = await rollbackOrganizationCreation(
        deleteTenantOrganization,
        organization.id
      )
      if (!rollbackSucceeded) {
        console.error("deleteTenantOrganization rollback failed", {
          organizationId: organization.id,
          reason: "CREATOR_ROLE_MISSING",
        })
        return toRollbackFailedResponse(set, organization.id)
      }

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
        userId,
        roleSlug: getBootstrapCreatorRoleSlug(),
      })

      const creatorHasValidRole = await verifyCreatorMembershipRole({
        listTenantBootstrapMembershipsForUser,
        organizationId: organization.id,
        userId,
      })

      if (!creatorHasValidRole) {
        const rollbackSucceeded = await rollbackOrganizationCreation(
          deleteTenantOrganization,
          organization.id
        )
        if (!rollbackSucceeded) {
          console.error("deleteTenantOrganization rollback failed", {
            organizationId: organization.id,
            reason: "CREATOR_MEMBERSHIP_VERIFICATION_FAILED",
          })
          return toRollbackFailedResponse(set, organization.id)
        }
        set.status = 500

        return {
          ok: false,
          error: "ORGANIZATION_BOOTSTRAP_FAILED",
          message: "Unable to create organization right now.",
        }
      }
    } catch (error) {
      const rollbackSucceeded = await rollbackOrganizationCreation(
        deleteTenantOrganization,
        organization.id
      )
      if (!rollbackSucceeded) {
        console.error("deleteTenantOrganization rollback failed", {
          organizationId: organization.id,
          reason: "MEMBERSHIP_CREATION_ERROR",
        })
        return toRollbackFailedResponse(set, organization.id)
      }

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

    set.status = 201

    // Persist the chosen billing currency by creating the BillingAccount now.
    // Non-fatal: if this fails, the JIT path will still create the account
    // later (defaulting to IDR), so org creation should not be rolled back.
    try {
      await prisma.billingAccount.upsert({
        where: { organizationId: organization.id },
        update: {},
        create: {
          organizationId: organization.id,
          balance: new Prisma.Decimal(0),
          currency,
          timezone: "UTC",
          status: "ACTIVE",
        },
      })
    } catch (billingError) {
      console.error("createBillingAccount during org bootstrap failed", {
        organizationId: organization.id,
        error:
          billingError instanceof Error
            ? billingError.message
            : "Unknown error",
      })
    }

    return {
      ok: true,
      organizationId: organization.id,
    }
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
}
