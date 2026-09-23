import { Elysia, t } from "elysia"
import {
  requireSuperAdmin,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import {
  listAdminStacks,
  adminSuspendStack,
  adminResumeStack,
  adminDeleteStack,
  adminPurgeTerminatedStack,
} from "@/modules/deploy/admin-stacks.service"

export type AdminStacksRouteDeps = {
  requireSuperAdmin?: typeof requireSuperAdmin
  listAdminStacks?: typeof listAdminStacks
  adminSuspendStack?: typeof adminSuspendStack
  adminResumeStack?: typeof adminResumeStack
  adminDeleteStack?: typeof adminDeleteStack
  adminPurgeTerminatedStack?: typeof adminPurgeTerminatedStack
}

export const createAdminStacksRoutes = (deps: AdminStacksRouteDeps = {}) => {
  const {
    requireSuperAdmin: guard = requireSuperAdmin,
    listAdminStacks: listStacks = listAdminStacks,
    adminSuspendStack: suspendStack = adminSuspendStack,
    adminResumeStack: resumeStack = adminResumeStack,
    adminDeleteStack: deleteStack = adminDeleteStack,
    adminPurgeTerminatedStack: purgeStack = adminPurgeTerminatedStack,
  } = deps

  return new Elysia()
    .get(
      "/admin/app-hosting/stacks",
      async ({ query, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const result = await listStacks({
            page: query.page,
            limit: query.limit,
            organizationId: query.organizationId,
            query: query.query,
            status: query.status,
          })

          return {
            ok: true as const,
            data: result.data,
            pagination: {
              page: result.page,
              limit: result.limit,
              total: result.total,
              totalPages: result.totalPages,
            },
          }
        } catch (error) {
          console.error("[admin-stacks] list error:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_ERROR",
            message: "Failed to list application stacks",
          }
        }
      },
      {
        query: t.Object({
          page: t.Optional(t.Numeric()),
          limit: t.Optional(t.Numeric()),
          organizationId: t.Optional(t.String()),
          query: t.Optional(t.String()),
          status: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/admin/app-hosting/stacks/:id/suspend",
      async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const result = await suspendStack(params.id)
          // If gitops was configured but push failed, surface a partial-success warning
          const gitopsConfigured = result.gitopsPushed !== undefined
          const partialFailure = gitopsConfigured && !result.gitopsPushed
          return {
            ok: true as const,
            message: partialFailure
              ? "Stack marked as suspended in DB but GitOps push failed — runtime may not scale down immediately"
              : "Stack suspended successfully",
            data: result,
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (msg.startsWith("NOT_FOUND")) {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND",
              message: "Application stack not found",
            }
          }
          if (msg.startsWith("ALREADY_TERMINATED")) {
            set.status = 409
            return {
              ok: false as const,
              error: "ALREADY_TERMINATED",
              message: "Stack is already terminated",
            }
          }
          console.error("[admin-stacks] suspend error:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_ERROR",
            message: "Failed to suspend application stack",
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
      }
    )
    .post(
      "/admin/app-hosting/stacks/:id/resume",
      async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const result = await resumeStack(params.id)
          const gitopsConfigured = result.gitopsPushed !== undefined
          const partialFailure = gitopsConfigured && !result.gitopsPushed
          return {
            ok: true as const,
            message: partialFailure
              ? "Stack marked as resumed in DB but GitOps push failed — runtime may not scale up immediately"
              : "Stack resumed successfully",
            data: result,
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (msg.startsWith("NOT_FOUND")) {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND",
              message: "Application stack not found",
            }
          }
          if (msg.startsWith("ALREADY_TERMINATED")) {
            set.status = 409
            return {
              ok: false as const,
              error: "ALREADY_TERMINATED",
              message: "Stack is already terminated",
            }
          }
          console.error("[admin-stacks] resume error:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_ERROR",
            message: "Failed to resume application stack",
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
      }
    )
    .delete(
      "/admin/app-hosting/stacks/:id",
      async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const result = await deleteStack(params.id)
          const slug = params.id
          return {
            ok: true as const,
            message: `Stack ${slug} marked for termination. Infrastructure will be scaled to 0 immediately. Data will be purged in 30 days.`,
            data: result,
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (msg.startsWith("NOT_FOUND")) {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND",
              message: "Application stack not found",
            }
          }
          if (msg.startsWith("ALREADY_TERMINATED")) {
            set.status = 409
            return {
              ok: false as const,
              error: "ALREADY_TERMINATED",
              message: "Stack is already terminated",
            }
          }
          console.error("[admin-stacks] delete error:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_ERROR",
            message: "Failed to terminate application stack",
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
      }
    )
    .post(
      "/admin/app-hosting/stacks/:id/purge",
      async ({ params, set }) => {
        const actor = await guard(set)
        if ("ok" in actor && !actor.ok) {
          return actor as AdminApiError
        }

        try {
          const result = await purgeStack(params.id)
          return {
            ok: true as const,
            message: "Stack purged",
            data: result,
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          if (msg.startsWith("NOT_FOUND")) {
            set.status = 404
            return {
              ok: false as const,
              error: "NOT_FOUND",
              message: "Application stack not found",
            }
          }
          if (msg.startsWith("NOT_TERMINATED")) {
            set.status = 409
            return {
              ok: false as const,
              error: "NOT_TERMINATED",
              message: "Stack is not in TERMINATED state",
            }
          }
          console.error("[admin-stacks] purge error:", error)
          set.status = 500
          return {
            ok: false as const,
            error: "INTERNAL_ERROR",
            message: "Failed to purge application stack",
          }
        }
      },
      {
        params: t.Object({ id: t.String() }),
      }
    )
}
