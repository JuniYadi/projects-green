import { Elysia } from "elysia"

import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"

import {
  createVpnServerSchema,
  updateVpnServerSchema,
} from "../vpn-server.schema"
import { toVpnServerDTO } from "../vpn-server.dto"
import {
  VpnServerConflictError,
  VpnServerNotFoundError,
  VpnServerReferenceError,
  vpnServerService,
  type VpnServerService,
} from "../vpn-server.service"
import {
  scanVpnServerConnection,
  type VpnServerScanner,
} from "../vpn-connection-scanner"

type Deps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  service?: VpnServerService
  scanConnection?: VpnServerScanner
  /** Injectable clock for rate-limit testing. */
  now?: () => number
}

/** Min interval between connection tests for the same server. */
export const TEST_RATE_LIMIT_MS = 30_000

export const createAdminVpnServersRoutes = (deps: Deps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const service = deps.service ?? vpnServerService
  const scanConnection = deps.scanConnection ?? scanVpnServerConnection
  const now = deps.now ?? Date.now
  const lastTestAt = new Map<string, number>()

  return new Elysia()
    .get("/admin/vpn/servers", async ({ query, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const regionId =
        typeof query.regionId === "string" && query.regionId.length > 0
          ? query.regionId
          : undefined
      const servers = await service.list({ regionId })
      return { ok: true, data: servers.map(toVpnServerDTO) }
    })
    .post(
      "/admin/vpn/servers",
      async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const server = await service.create(body)
          set.status = 201
          return { ok: true, data: toVpnServerDTO(server) }
        } catch (error) {
          return toServerError(set, error)
        }
      },
      { body: createVpnServerSchema }
    )
    .put(
      "/admin/vpn/servers/:id",
      async ({ params, body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const server = await service.update(params.id, body)
          return { ok: true, data: toVpnServerDTO(server) }
        } catch (error) {
          return toServerError(set, error)
        }
      },
      { body: updateVpnServerSchema }
    )
    .delete("/admin/vpn/servers/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      try {
        await service.remove(params.id)
        return { ok: true }
      } catch (error) {
        return toServerError(set, error)
      }
    })
    .post("/admin/vpn/servers/:id/test", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const current = now()
      const previous = lastTestAt.get(params.id)
      if (previous !== undefined && current - previous < TEST_RATE_LIMIT_MS) {
        const retryAfterSec = Math.ceil(
          (TEST_RATE_LIMIT_MS - (current - previous)) / 1000
        )
        set.status = 429
        return {
          ok: false,
          error: "RATE_LIMITED",
          message: `Please wait ${retryAfterSec}s before testing this server again.`,
        }
      }

      try {
        const server = await service.getById(params.id)
        lastTestAt.set(params.id, current)
        const result = await scanConnection(server)
        return { ok: true, data: result }
      } catch (error) {
        return toServerError(set, error)
      }
    })
}

type RouteSet = { status?: number | string }

function toServerError(set: RouteSet, error: unknown): AdminApiError {
  if (error instanceof VpnServerNotFoundError) {
    set.status = 404
    return { ok: false, error: "NOT_FOUND", message: error.message }
  }
  if (error instanceof VpnServerReferenceError) {
    set.status = 422
    return { ok: false, error: "INVALID_REFERENCE", message: error.message }
  }
  if (error instanceof VpnServerConflictError) {
    set.status = 409
    return { ok: false, error: "CONFLICT", message: error.message }
  }
  set.status = 500
  return {
    ok: false,
    error: "INTERNAL_ERROR",
    message: "Something went wrong while processing the server.",
  }
}
