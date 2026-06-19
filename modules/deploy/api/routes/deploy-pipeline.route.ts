import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { getDeployEvents, getDeployLogs } from "../../deploy-event.service"
import { getMonitorStats } from "../../deploy-monitor.service"

export const deployPipelineRoutes = new Elysia({ prefix: "/deploy" })
  .get(
    "/pipeline/status/:deployId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const deployment = await prisma.applicationDeployment.findUnique({
        where: { id: params.deployId },
        include: { stack: true },
      })

      if (!deployment) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Deployment not found",
        }
      }

      if (deployment.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      return {
        ok: true,
        data: {
          id: deployment.id,
          stackName: deployment.stack.name,
          stackSlug: deployment.stack.slug,
          status: deployment.status,
          manifestPushed: deployment.manifestPushed,
          manifestPushedAt: deployment.manifestPushedAt,
          argocdSynced: deployment.argocdSynced,
          argocdSyncedAt: deployment.argocdSyncedAt,
          startedAt: deployment.startedAt,
          completedAt: deployment.completedAt,
          failureReason: deployment.failureReason,
          attempt: deployment.attempt,
        },
      }
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
  .get(
    "/pipeline/events/:deployId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const deployment = await prisma.applicationDeployment.findUnique({
        where: { id: params.deployId },
      })

      if (!deployment) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Deployment not found",
        }
      }

      if (deployment.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      const events = await getDeployEvents(params.deployId)
      return { ok: true, data: events }
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
  .get(
    "/pipeline/logs/:deployId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const deployment = await prisma.applicationDeployment.findUnique({
        where: { id: params.deployId },
      })

      if (!deployment) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Deployment not found",
        }
      }

      if (deployment.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied" }
      }

      const logs = await getDeployLogs(params.deployId)
      return { ok: true, data: logs }
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
  .get("/pipeline/monitor-stats", async ({ set }) => {
    const auth = await withAuth()
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
    }

    const stats = await getMonitorStats()
    return { ok: true, data: stats }
  })
