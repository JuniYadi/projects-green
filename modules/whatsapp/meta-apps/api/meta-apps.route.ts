import { Elysia } from "elysia"

import { fieldErrorMapFromIssues } from "@/lib/validation"
import {
  requireSuperAdmin,
  type AdminActorContext,
  type AdminApiError,
  type RouteSet,
} from "@/modules/admin/api/admin.guards"
import {
  metaAppsService,
  MetaAppConflictError,
  type MetaAppsService,
} from "../meta-apps.service"
import { createMetaAppSchema, updateMetaAppSchema } from "../meta-apps.schemas"
import type { WhatsappMetaAppDTO } from "../meta-apps.dto"

type AdminGuard = (set: RouteSet) => Promise<AdminActorContext | AdminApiError>
type AdminMetaAppsService = Pick<
  MetaAppsService,
  "list" | "get" | "create" | "update" | "delete"
>

type AdminMetaAppsDeps = {
  requireSuperAdmin?: AdminGuard
  service?: AdminMetaAppsService
}

const isAdminError = (
  value: AdminActorContext | AdminApiError
): value is AdminApiError => "ok" in value && !value.ok

const getErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code
    return typeof code === "string" ? code : undefined
  }
  return undefined
}

const publicMetaApp = (app: WhatsappMetaAppDTO) => ({
  id: app.id,
  name: app.name,
  metaAppId: app.metaAppId,
  webhookKey: app.webhookKey,
  active: app.active,
  createdAt: app.createdAt,
  updatedAt: app.updatedAt,
  callbackPath: app.callbackPath,
})

const validationError = (
  set: RouteSet,
  issues: Array<{ path: PropertyKey[]; message: string }>
) => {
  set.status = 422
  return {
    ok: false as const,
    error: "VALIDATION_ERROR" as const,
    message: "Please fix the highlighted fields and try again.",
    fieldErrors: fieldErrorMapFromIssues(issues),
  }
}

const notFoundError = (set: RouteSet) => {
  set.status = 404
  return {
    ok: false as const,
    error: "NOT_FOUND" as const,
    message: "Meta app not found.",
  }
}

const conflictError = (set: RouteSet) => {
  set.status = 409
  return {
    ok: false as const,
    error: "CONFLICT" as const,
    message: "Meta app conflicts with an existing resource.",
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
  const code = getErrorCode(error)
  if (
    error instanceof MetaAppConflictError ||
    code === "META_APP_HAS_DEVICES" ||
    code === "P2002" ||
    code === "P2003"
  ) {
    return conflictError(set)
  }
  if (code === "P2025") return notFoundError(set)
  return internalError(set)
}

export const createAdminMetaAppsRoutes = (deps: AdminMetaAppsDeps = {}) => {
  const guard = deps.requireSuperAdmin ?? requireSuperAdmin
  const service = deps.service ?? metaAppsService

  return new Elysia({ prefix: "/admin/whatsapp/meta-apps" })
    .get("/", async ({ set }) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      try {
        const apps = await service.list({ activeOnly: false })
        return { ok: true as const, data: apps.map(publicMetaApp) }
      } catch (error) {
        return mapServiceError(set, error)
      }
    })
    .get("/:id", async ({ params: { id }, set }) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      try {
        const app = await service.get(id)
        if (!app) return notFoundError(set)
        return { ok: true as const, data: publicMetaApp(app) }
      } catch (error) {
        return mapServiceError(set, error)
      }
    })
    .post("/", async ({ body, set }) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const parsed = createMetaAppSchema.safeParse(body)
      if (!parsed.success) return validationError(set, parsed.error.issues)

      try {
        const app = await service.create(parsed.data)
        set.status = 201
        return { ok: true as const, data: publicMetaApp(app) }
      } catch (error) {
        return mapServiceError(set, error)
      }
    })
    .patch("/:id", async ({ params: { id }, body, set }) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const parsed = updateMetaAppSchema.safeParse(body)
      if (!parsed.success) return validationError(set, parsed.error.issues)

      try {
        const app = await service.update(id, parsed.data)
        return { ok: true as const, data: publicMetaApp(app) }
      } catch (error) {
        return mapServiceError(set, error)
      }
    })
    .delete("/:id", async ({ params: { id }, set }) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      try {
        const app = await service.delete(id)
        if (!app) return notFoundError(set)
        return { ok: true as const, data: publicMetaApp(app) }
      } catch (error) {
        return mapServiceError(set, error)
      }
    })
}
