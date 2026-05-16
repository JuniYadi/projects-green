import {
  isTenantApiError,
  type TenantApiError,
} from "@/modules/tenants/contracts/tenant-api.contract"

export { isTenantApiError }

export type RouteSet = { status?: number | string }

export const toPolicyError = (
  set: RouteSet,
  policyCode: string,
  message: string
): TenantApiError => {
  set.status = 403

  return {
    ok: false,
    error: "FORBIDDEN",
    policyCode,
    message,
  }
}

export const toUnauthorizedError = (set: RouteSet): TenantApiError => {
  set.status = 401

  return {
    ok: false,
    error: "UNAUTHORIZED",
    message: "You must be signed in to manage tenants.",
  }
}
