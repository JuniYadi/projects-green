import { Elysia } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import { getPlatformRoleForUser } from "@/lib/platform-role"
import { fieldErrorMapFromIssues } from "@/lib/validation"
import {
  normalizeDocPath,
  getDocByPath as getDocByPathService,
  upsertDocByPath as upsertDocByPathService,
} from "@/modules/docs/docs.service"

const docsQuerySchema = z.object({
  path: z.string().min(1),
})

const docsBodySchema = z.object({
  path: z.string().min(1),
  title: z.string().min(1),
  purpose: z.string().min(1),
  howTo: z.array(z.string().min(1)).min(1),
  notes: z.array(z.string().min(1)).optional(),
  organizationId: z.string().min(1).nullable().optional(),
})

type DocsAuthContext = {
  organizationId?: string | null
  user: {
    email?: string | null
    id: string
  } | null
}

type RouteSet = {
  status?: number | string
}

type DocsRouteDependencies = {
  authenticate: () => Promise<DocsAuthContext>
  getPlatformRole: (input: {
    email?: string | null
    id?: string | null
  }) => Promise<"none" | "super_admin">
  getDocByPath: typeof getDocByPathService
  upsertDocByPath: typeof upsertDocByPathService
}

const createDefaultDependencies = (): DocsRouteDependencies => ({
  authenticate: () => withAuth(),
  getPlatformRole: getPlatformRoleForUser,
  getDocByPath: getDocByPathService,
  upsertDocByPath: upsertDocByPathService,
})

const toUnauthorized = (set: RouteSet) => {
  set.status = 401

  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to access documentation.",
  }
}

const toForbidden = (set: RouteSet) => {
  set.status = 403

  return {
    ok: false as const,
    error: "FORBIDDEN" as const,
    message: "Only super admins can update documentation entries.",
  }
}

const toValidationError = (
  set: RouteSet,
  issues: Array<{ path: Array<PropertyKey>; message: string }>
) => {
  set.status = 422

  return {
    ok: false as const,
    error: "VALIDATION_ERROR" as const,
    message: "Please fix the highlighted fields and try again.",
    fieldErrors: fieldErrorMapFromIssues(issues),
  }
}

export const createDocsRoutes = (
  dependencies: DocsRouteDependencies = createDefaultDependencies()
) =>
  new Elysia()
    .get("/docs", async ({ query, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      const parsed = docsQuerySchema.safeParse(query)

      if (!parsed.success) {
        return toValidationError(set, parsed.error.issues)
      }

      const doc = await dependencies.getDocByPath({
        path: parsed.data.path,
        organizationId: auth.organizationId ?? null,
      })

      if (!doc) {
        set.status = 404
        return {
          ok: false as const,
          error: "DOC_NOT_FOUND" as const,
          message: `No documentation found for path "${parsed.data.path}".`,
        }
      }

      return {
        ok: true as const,
        ...doc,
      }
    })
    .post("/docs", async ({ body, set }) => {
      const auth = await dependencies.authenticate()

      if (!auth.user) {
        return toUnauthorized(set)
      }

      const platformRole = await dependencies.getPlatformRole({
        id: auth.user.id,
        email: auth.user.email,
      })

      if (platformRole !== "super_admin") {
        return toForbidden(set)
      }

      const parsed = docsBodySchema.safeParse(body)

      if (!parsed.success) {
        return toValidationError(set, parsed.error.issues)
      }

      const normalizedPath = normalizeDocPath(parsed.data.path)

      if (!normalizedPath) {
        return toValidationError(set, [
          {
            path: ["path"],
            message: "Path must not be empty.",
          },
        ])
      }

      const normalizedHowTo = parsed.data.howTo
        .map((item) => item.trim())
        .filter((item) => item.length > 0)

      if (!normalizedHowTo.length) {
        return toValidationError(set, [
          {
            path: ["howTo"],
            message: "How-to steps must contain at least one non-empty item.",
          },
        ])
      }

      const targetOrganizationId =
        parsed.data.organizationId === undefined
          ? (auth.organizationId ?? null)
          : parsed.data.organizationId

      const savedDoc = await dependencies.upsertDocByPath({
        organizationId: targetOrganizationId,
        path: normalizedPath,
        title: parsed.data.title.trim(),
        purpose: parsed.data.purpose.trim(),
        howTo: normalizedHowTo,
        notes: parsed.data.notes
          ?.map((item) => item.trim())
          .filter((item) => item.length > 0),
        updatedByWorkosUserId: auth.user.id,
      })

      set.status = 201

      return {
        ok: true as const,
        ...savedDoc,
      }
    })

export const docsRoutes = createDocsRoutes()
export type App = ReturnType<typeof createDocsRoutes>
