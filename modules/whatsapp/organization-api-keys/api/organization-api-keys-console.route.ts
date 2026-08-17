import { Elysia } from "elysia"

import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

import {
  WhatsappOrganizationApiKeyAlreadyActiveError,
  WhatsappOrganizationApiKeyNotFoundError,
  whatsappOrganizationApiKeysService,
  type WhatsappOrganizationApiKeysService,
} from "../organization-api-keys.service"
import type { WhatsappOrganizationApiKeyDTO } from "../organization-api-keys.dto"

export type ConsoleOrganizationApiKeyRouteDependencies = {
  service?: WhatsappOrganizationApiKeysService
}

type RouteSet = { status?: number | string }

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

const authorize = async (request: Request, set: RouteSet) => {
  const whatsappAuth = await resolveAuthContext(request)
  if (!whatsappAuth) {
    set.status = 401
    return {
      ok: false as const,
      error: "UNAUTHORIZED" as const,
      message: "Auth required.",
    }
  }

  if (whatsappAuth.type !== "workos" || !whatsappAuth.organizationId) {
    set.status = 400
    return {
      ok: false as const,
      error: "BAD_REQUEST" as const,
      message: "Organization context required.",
    }
  }

  const canManage =
    whatsappAuth.platformRole === "super_admin" ||
    whatsappAuth.orgRole === "admin" ||
    whatsappAuth.orgRole === "owner"
  if (!canManage) {
    set.status = 403
    return {
      ok: false as const,
      error: "FORBIDDEN" as const,
      message: "Only organization admins can manage the API key.",
    }
  }

  return {
    organizationId: whatsappAuth.organizationId,
    actorId: whatsappAuth.userId,
  }
}

const mapServiceError = (set: RouteSet, error: unknown) => {
  if (error instanceof WhatsappOrganizationApiKeyAlreadyActiveError) {
    set.status = 409
    return {
      ok: false as const,
      error: "CONFLICT" as const,
      message:
        "An active key already exists for this organization. Rotate it instead.",
    }
  }

  if (error instanceof WhatsappOrganizationApiKeyNotFoundError) {
    set.status = 404
    return {
      ok: false as const,
      error: "NOT_FOUND" as const,
      message: "No active key was found for this organization.",
    }
  }

  set.status = 500
  return {
    ok: false as const,
    error: "INTERNAL_SERVER_ERROR" as const,
    message: "An unexpected error occurred.",
  }
}

export const createConsoleWhatsappOrganizationApiKeyRoutes = (
  dependencies: ConsoleOrganizationApiKeyRouteDependencies = {}
) => {
  const service = dependencies.service ?? whatsappOrganizationApiKeysService

  return new Elysia({ prefix: "/organization-api-keys" })
    .get("/self", async ({ request, set }: any) => {
      const auth = await authorize(request, set)
      if ("ok" in auth) return auth

      try {
        const data = await service.getOrganizationKeyState(auth.organizationId)
        return { ok: true as const, data }
      } catch (error) {
        return mapServiceError(set, error)
      }
    })
    .post("/self", async ({ request, set }: any) => {
      const auth = await authorize(request, set)
      if ("ok" in auth) return auth

      try {
        const result = await service.generate({
          organizationId: auth.organizationId,
          actorId: auth.actorId,
        })
        set.status = 201
        return generatedKeyResponse(result)
      } catch (error) {
        return mapServiceError(set, error)
      }
    })
    .post("/self/rotate", async ({ request, set }: any) => {
      const auth = await authorize(request, set)
      if ("ok" in auth) return auth

      try {
        const result = await service.rotate({
          organizationId: auth.organizationId,
          actorId: auth.actorId,
        })
        return generatedKeyResponse(result)
      } catch (error) {
        return mapServiceError(set, error)
      }
    })
    .post("/self/revoke", async ({ request, set }: any) => {
      const auth = await authorize(request, set)
      if ("ok" in auth) return auth

      try {
        const key = await service.revoke({
          organizationId: auth.organizationId,
          actorId: auth.actorId,
        })
        return { ok: true as const, data: { key } }
      } catch (error) {
        return mapServiceError(set, error)
      }
    })
}

export const consoleOrganizationApiKeyRoutes =
  createConsoleWhatsappOrganizationApiKeyRoutes()
