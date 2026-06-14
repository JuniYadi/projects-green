import { Elysia } from "elysia"

import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"

import {
  createVpnPackageSchema,
  updateVpnPackageSchema,
} from "../vpn-package.schema"
import { toVpnPackageDTO } from "../vpn-package.dto"
import {
  VpnPackageNotFoundError,
  VpnPackageValidationError,
  vpnPackageService,
  type VpnPackageService,
} from "../vpn-package.service"

type Deps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  service?: VpnPackageService
}

export const createAdminVpnPackagesRoutes = (deps: Deps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const service = deps.service ?? vpnPackageService

  return new Elysia()
    .get("/admin/vpn/packages", async ({ set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const packages = await service.list()
      return { ok: true, data: packages.map(toVpnPackageDTO) }
    })
    .post(
      "/admin/vpn/packages",
      async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const pkg = await service.create(body)
          set.status = 201
          return { ok: true, data: toVpnPackageDTO(pkg) }
        } catch (error) {
          return toPackageError(set, error)
        }
      },
      { body: createVpnPackageSchema }
    )
    .put(
      "/admin/vpn/packages/:id",
      async ({ params, body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const pkg = await service.update(params.id, body)
          return { ok: true, data: toVpnPackageDTO(pkg) }
        } catch (error) {
          return toPackageError(set, error)
        }
      },
      { body: updateVpnPackageSchema }
    )
    .delete("/admin/vpn/packages/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      try {
        const pkg = await service.deactivate(params.id)
        return { ok: true, data: toVpnPackageDTO(pkg) }
      } catch (error) {
        return toPackageError(set, error)
      }
    })
}

type RouteSet = { status?: number | string }

function toPackageError(set: RouteSet, error: unknown): AdminApiError {
  if (error instanceof VpnPackageNotFoundError) {
    set.status = 404
    return { ok: false, error: "NOT_FOUND", message: error.message }
  }
  if (error instanceof VpnPackageValidationError) {
    set.status = 422
    return { ok: false, error: "VALIDATION_ERROR", message: error.message }
  }
  set.status = 500
  return {
    ok: false,
    error: "INTERNAL_ERROR",
    message: "Something went wrong while processing the package.",
  }
}
