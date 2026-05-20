import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import type { RouteSet } from "@/modules/tenants/api/tenants.errors"
import type {
  TenantApiError,
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

export const defaultTenantCreateOrganizationDeps: TenantCreateOrganizationDeps = {
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

export const createTenantOrganizationWithCreator = async (params: {
  set: RouteSet
  userId: string
  organizationName: string
  deps: TenantCreateOrganizationDeps
}): Promise<TenantBootstrapCreateResponse | TenantApiError> => {
  const {
    set,
    userId,
    organizationName,
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

    const creatorRoleIsAvailable = await hasBootstrapCreatorRole(organization.id)
    if (!creatorRoleIsAvailable) {
      await rollbackOrganizationCreation(deleteTenantOrganization, organization.id)
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
      await rollbackOrganizationCreation(deleteTenantOrganization, organization.id)
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
    }
  } catch (error) {
    if (error instanceof ConflictException) {
      set.status = 409

      return {
        ok: false,
        error: "ORGANIZATION_CONFLICT",
        message: "Organization bootstrap could not be completed due to a conflict.",
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
