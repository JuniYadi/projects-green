import { Elysia } from "elysia"

import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"

import {
  createVpnRegionSchema,
  updateVpnRegionSchema,
} from "../vpn-region.schema"
import { toVpnRegionDTO } from "../vpn-region.dto"
import {
  VpnRegionConflictError,
  VpnRegionInUseError,
  VpnRegionNotFoundError,
  vpnRegionService,
  type VpnRegionService,
} from "../vpn-region.service"

type Deps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  service?: VpnRegionService
}

export const createAdminVpnRegionsRoutes = (deps: Deps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const service = deps.service ?? vpnRegionService

  return new Elysia()
    .get("/admin/vpn/regions", async ({ set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const regions = await service.list()
      return { ok: true, data: regions.map(toVpnRegionDTO) }
    })
    .post(
      "/admin/vpn/regions",
      async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const region = await service.create(body)
          set.status = 201
          return { ok: true, data: toVpnRegionDTO(region) }
        } catch (error) {
          return toRegionError(set, error)
        }
      },
      { body: createVpnRegionSchema }
    )
    .put(
      "/admin/vpn/regions/:id",
      async ({ params, body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const region = await service.update(params.id, body)
          return { ok: true, data: toVpnRegionDTO(region) }
        } catch (error) {
          return toRegionError(set, error)
        }
      },
      { body: updateVpnRegionSchema }
    )
    .delete("/admin/vpn/regions/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      try {
        await service.remove(params.id)
        return { ok: true }
      } catch (error) {
        return toRegionError(set, error)
      }
    })
}

type RouteSet = { status?: number | string }

function toRegionError(set: RouteSet, error: unknown): AdminApiError {
  if (error instanceof VpnRegionNotFoundError) {
    set.status = 404
    return { ok: false, error: "NOT_FOUND", message: error.message }
  }
  if (error instanceof VpnRegionInUseError) {
    set.status = 409
    return { ok: false, error: "REGION_IN_USE", message: error.message }
  }
  if (error instanceof VpnRegionConflictError) {
    set.status = 409
    return { ok: false, error: "CONFLICT", message: error.message }
  }
  set.status = 500
  return {
    ok: false,
    error: "INTERNAL_ERROR",
    message: "Something went wrong while processing the region.",
  }
}
