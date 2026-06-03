import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { triggerDeploy } from "../../deploy-pipeline.service"
import { rollbackDeployment, getRollbackOptions } from "../../deploy-rollback.service"
import { resolveTenantRoleFromClaims, hasScopedSuperAdminClaim } from "@/modules/tenants/tenant-policy"
import { getPlatformRoleForUser } from "@/lib/platform-role"

export const deployTriggerRoutes = new Elysia({ prefix: "/deploy" })
  .post(
    "/trigger/:stackId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      if (!auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Organization required" }
      }

      // Check deploy permissions
      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin = platformRole === "super_admin" || hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)
      if (!isSuperAdmin) {
        const tenantRole = resolveTenantRoleFromClaims(auth.role ?? null, auth.roles ?? null)
        if (tenantRole !== "owner" && tenantRole !== "admin") {
          set.status = 403
          return { ok: false, error: "FORBIDDEN", message: "Admin/Owner role required for deploy operations" }
        }
      }

      const stack = await prisma.applicationStack.findUnique({
        where: { id: params.stackId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Stack not found" }
      }

      if (stack.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      const result = await triggerDeploy({
        stackId: params.stackId,
        triggerType: "MANUAL",
      })

      return { ok: true, data: result }
    },
    {
      params: t.Object({
        stackId: t.String(),
      }),
    }
  )
  .post(
    "/rollback/:stackId",
    async ({ params, body, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      if (!auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Organization required" }
      }

      // Check deploy permissions
      const platformRole = await getPlatformRoleForUser(auth.user)
      const isSuperAdmin = platformRole === "super_admin" || hasScopedSuperAdminClaim(auth.role ?? null, auth.roles ?? null)
      if (!isSuperAdmin) {
        const tenantRole = resolveTenantRoleFromClaims(auth.role ?? null, auth.roles ?? null)
        if (tenantRole !== "owner" && tenantRole !== "admin") {
          set.status = 403
          return { ok: false, error: "FORBIDDEN", message: "Admin/Owner role required for deploy operations" }
        }
      }

      const stack = await prisma.applicationStack.findUnique({
        where: { id: params.stackId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Stack not found" }
      }

      if (stack.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      const result = await rollbackDeployment({
        stackId: params.stackId,
        targetDeploymentId: body.targetDeploymentId,
      })

      return { ok: true, data: result }
    },
    {
      params: t.Object({
        stackId: t.String(),
      }),
      body: t.Object({
        targetDeploymentId: t.String(),
      }),
    }
  )
  .get(
    "/rollback-options/:stackId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const stack = await prisma.applicationStack.findUnique({
        where: { id: params.stackId },
      })

      if (!stack) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Stack not found" }
      }

      if (stack.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      const options = await getRollbackOptions(params.stackId)
      return { ok: true, data: options }
    },
    {
      params: t.Object({
        stackId: t.String(),
      }),
    }
  )
