import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { queryLogs } from "../../opensearch/opensearch-log.service"

export const monitoringRoutes = new Elysia({ prefix: "/deploy" })
  .get(
    "/logs/:deployId",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const result = await queryLogs({
        tenantSlug: (auth.user as Record<string, unknown>).metadata
          ? ((auth.user as Record<string, unknown>).metadata as Record<string, string>).orgSlug ?? "default"
          : "default",
        deployId: params.deployId,
        size: 200,
      })

      return { ok: true, data: result.hits }
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
  .get(
    "/events/:deployId",
    async ({ set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      // TODO: Look up deploy by ID, return real timeline events
      // const deployEvents = await prisma.deploymentEvent.findMany({ where: { deployId } })
      return { ok: true, data: [] } // placeholder
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
  .get(
    "/status/:deployId",
    async ({ set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      // TODO: Look up deploy by ID, return real status
      // const deploy = await prisma.deployment.findUnique({ where: { id: deployId } })
      return { ok: true, data: { status: "queued", attempt: 1 } } // placeholder
    },
    {
      params: t.Object({
        deployId: t.String(),
      }),
    }
  )
