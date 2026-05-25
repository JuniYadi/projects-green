import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@workos-inc/node"

import type { AdminApiError } from "@/modules/admin/api/admin.guards"

export type RouteSet = { status?: number | string }

export const toWorkosError = (
  set: RouteSet,
  error: unknown
): AdminApiError => {
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

  set.status = 500
  return {
    ok: false,
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred.",
  }
}