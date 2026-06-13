import { Elysia } from "elysia"

import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"

import { createVpnSshKeySchema } from "../vpn-ssh-key.schema"
import { toVpnSshKeyDTO } from "../vpn-ssh-key.dto"
import {
  VpnSshKeyAlreadyExistsError,
  VpnSshKeyInUseError,
  VpnSshKeyNotFoundError,
  vpnSshKeyService,
  type VpnSshKeyService,
} from "../vpn-ssh-key.service"
import { VpnSshKeyError } from "../vpn-ssh-key.crypto"

type Deps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  service?: VpnSshKeyService
}

export const createAdminVpnSshKeysRoutes = (deps: Deps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const service = deps.service ?? vpnSshKeyService

  return new Elysia()
    .get("/admin/vpn/ssh-keys", async ({ set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      const keys = await service.list()
      return { ok: true, data: keys.map(toVpnSshKeyDTO) }
    })
    .post(
      "/admin/vpn/ssh-keys",
      async ({ body, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) return actor as AdminApiError

        try {
          const key = await service.create(body)
          set.status = 201
          return { ok: true, data: toVpnSshKeyDTO(key) }
        } catch (error) {
          return toSshKeyError(set, error)
        }
      },
      { body: createVpnSshKeySchema }
    )
    .delete("/admin/vpn/ssh-keys/:id", async ({ params, set }) => {
      const actor = await guard(set)
      if ("ok" in actor && !actor.ok) return actor as AdminApiError

      try {
        await service.remove(params.id)
        return { ok: true }
      } catch (error) {
        return toSshKeyError(set, error)
      }
    })
}

type RouteSet = { status?: number | string }

function toSshKeyError(set: RouteSet, error: unknown): AdminApiError {
  if (error instanceof VpnSshKeyNotFoundError) {
    set.status = 404
    return { ok: false, error: "NOT_FOUND", message: error.message }
  }
  if (error instanceof VpnSshKeyAlreadyExistsError) {
    set.status = 409
    return { ok: false, error: "SSH_KEY_DUPLICATE", message: error.message }
  }
  if (error instanceof VpnSshKeyInUseError) {
    set.status = 409
    return { ok: false, error: "SSH_KEY_IN_USE", message: error.message }
  }
  if (error instanceof VpnSshKeyError) {
    set.status = 422
    return { ok: false, error: "INVALID_SSH_KEY", message: error.message }
  }
  set.status = 500
  return {
    ok: false,
    error: "INTERNAL_ERROR",
    message: "Something went wrong while processing the SSH key.",
  }
}
