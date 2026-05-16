import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import {
  isTenantApiError,
  type TenantApiError,
} from "@/modules/tenants/contracts/tenant-api.contract"
import { TenantWorkOSOperationUnsupportedError } from "@/modules/tenants/services/tenant-workos.service"

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

export const toNotFoundError = (
  set: RouteSet,
  message: string
): TenantApiError => {
  set.status = 404

  return {
    ok: false,
    error: "NOT_FOUND",
    message,
  }
}

export const toWorkosApiError = (
  set: RouteSet,
  error: unknown,
  defaults?: {
    fallbackError?: string
    fallbackMessage?: string
  }
): TenantApiError => {
  const errorWithStatus = error as { status?: unknown; message?: unknown }

  if (error instanceof BadRequestException) {
    set.status = 400
    return {
      ok: false,
      error: "WORKOS_BAD_REQUEST",
      message: error.message,
    }
  }

  if (error instanceof UnauthorizedException) {
    set.status = 401
    return {
      ok: false,
      error: "WORKOS_UNAUTHORIZED",
      message: error.message,
    }
  }

  if (errorWithStatus.status === 403) {
    set.status = 403
    return {
      ok: false,
      error: "WORKOS_FORBIDDEN",
      message:
        typeof errorWithStatus.message === "string"
          ? errorWithStatus.message
          : "You are not allowed to perform this WorkOS operation.",
    }
  }

  if (error instanceof NotFoundException) {
    set.status = 404
    return {
      ok: false,
      error: "WORKOS_NOT_FOUND",
      message: error.message,
    }
  }

  if (error instanceof ConflictException) {
    set.status = 409
    return {
      ok: false,
      error: "WORKOS_CONFLICT",
      message: error.message,
    }
  }

  if (error instanceof UnprocessableEntityException) {
    set.status = 422
    return {
      ok: false,
      error: "WORKOS_UNPROCESSABLE",
      message: error.message,
    }
  }

  if (error instanceof TenantWorkOSOperationUnsupportedError) {
    set.status = 501
    return {
      ok: false,
      error: "WORKOS_OPERATION_UNSUPPORTED",
      message: `Operation '${error.operation}' is not available in the current WorkOS SDK.`,
    }
  }

  set.status = 500
  return {
    ok: false,
    error: defaults?.fallbackError ?? "WORKOS_REQUEST_FAILED",
    message:
      defaults?.fallbackMessage ??
      "Unable to complete this tenant operation right now.",
  }
}
