import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { queryLogs } from "../../opensearch/opensearch-log.service"

export const monitoringRoutes = new Elysia({ prefix: "/deploy" })
  .get(
    "/logs/:logKey",
    async ({ params, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const userMeta = (auth.user as unknown as { metadata?: Record<string, string> })?.metadata
      const orgSlug = userMeta?.orgSlug

      if (!orgSlug) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied: no organization context" }
      }

      const result = await queryLogs({
        tenantSlug: orgSlug,
        deployId: params.logKey,
        size: 200,
      })

      return { ok: true, data: result.hits }
    },
    {
      params: t.Object({
        logKey: t.String(),
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
