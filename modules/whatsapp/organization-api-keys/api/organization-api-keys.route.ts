import { Elysia } from "elysia"
import { z } from "zod"

import {
  requireSuperAdmin,
  type AdminActorContext,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"

import {
  WhatsappOrganizationApiKeyAlreadyActiveError,
  WhatsappOrganizationApiKeyNotFoundError,
  whatsappOrganizationApiKeysService,
  type WhatsappOrganizationApiKeysService,
} from "../organization-api-keys.service"
import {
  inventoryQuerySchema,
  type InventoryQuery,
} from "../organization-api-keys.schemas"
import type { WhatsappOrganizationApiKeyDTO } from "../organization-api-keys.dto"

type AdminGuard = (set: RouteSet) => Promise<AdminActorContext | AdminApiError>

type RouteDependencies = {
  requireSuperAdmin?: AdminGuard
  service?: WhatsappOrganizationApiKeysService
}

const organizationParamsSchema = z.object({
  organizationId: z.string().trim().min(1),
})

const isAdminError = (
  value: AdminActorContext | AdminApiError
): value is AdminApiError => "ok" in value && !value.ok

const conflictError = (set: RouteSet) => {
  set.status = 409
  return {
    ok: false as const,
    error: "CONFLICT" as const,
    message:
      "An active key already exists for this organization. Rotate it instead.",
  }
}

const notFoundError = (set: RouteSet) => {
  set.status = 404
  return {
    ok: false as const,
    error: "NOT_FOUND" as const,
    message: "No active key was found for this organization.",
  }
}

const internalError = (set: RouteSet) => {
  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message: "An unexpected error occurred.",
  }
}

const mapServiceError = (set: RouteSet, error: unknown) => {
  if (
    error instanceof WhatsappOrganizationApiKeyAlreadyActiveError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002")
  ) {
    return conflictError(set)
  }

  if (
    error instanceof WhatsappOrganizationApiKeyNotFoundError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025")
  ) {
    return notFoundError(set)
  }

  // Generation can fail for misconfigured key hashing or infrastructure faults.
  return internalError(set)
}

type GeneratedKeyResult = {
  key: WhatsappOrganizationApiKeyDTO
  secret: string
}

const generatedKeyResponse = (result: GeneratedKeyResult) => ({
  ok: true as const,
  data: {
    key: result.key,
    secret: result.secret,
  },
})

export const createAdminWhatsappOrganizationApiKeyRoutes = (
  dependencies: RouteDependencies = {}
) => {
  const guard = dependencies.requireSuperAdmin ?? requireSuperAdmin
  const service = dependencies.service ?? whatsappOrganizationApiKeysService

  return new Elysia({ prefix: "/admin/whatsapp/organization-api-keys" })
    .get(
      "/",
      async ({ query, set }) => {
        const actor = await guard(set)
        if (isAdminError(actor)) return actor

        const parsed = inventoryQuerySchema.safeParse(query)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Invalid inventory filters.",
          }
        }

        try {
          const result = await service.listInventory(
            parsed.data as InventoryQuery
          )
          return { ok: true as const, ...result }
        } catch (error) {
          return mapServiceError(set, error)
        }
      },
      { query: inventoryQuerySchema }
    )
    .post(
      "/:organizationId",
      async ({ params, set }) => {
        const actor = await guard(set)
        if (isAdminError(actor)) return actor

        const parsed = organizationParamsSchema.safeParse(params)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Organization ID is required.",
          }
        }

        try {
          const result = await service.generate({
            organizationId: parsed.data.organizationId,
            actorId: actor.userId,
          })
          set.status = 201
          return generatedKeyResponse(result)
        } catch (error) {
          return mapServiceError(set, error)
        }
      },
      { params: organizationParamsSchema }
    )
    .post(
      "/:organizationId/rotate",
      async ({ params, set }) => {
        const actor = await guard(set)
        if (isAdminError(actor)) return actor

        const parsed = organizationParamsSchema.safeParse(params)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Organization ID is required.",
          }
        }

        try {
          const result = await service.rotate({
            organizationId: parsed.data.organizationId,
            actorId: actor.userId,
          })
          return generatedKeyResponse(result)
        } catch (error) {
          return mapServiceError(set, error)
        }
      },
      { params: organizationParamsSchema }
    )
    .post(
      "/:organizationId/revoke",
      async ({ params, set }) => {
        const actor = await guard(set)
        if (isAdminError(actor)) return actor

        const parsed = organizationParamsSchema.safeParse(params)
        if (!parsed.success) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: "Organization ID is required.",
          }
        }

        try {
          const key = await service.revoke({
            organizationId: parsed.data.organizationId,
            actorId: actor.userId,
          })
          return { ok: true as const, data: { key } }
        } catch (error) {
          return mapServiceError(set, error)
        }
      },
      { params: organizationParamsSchema }
    )
}
