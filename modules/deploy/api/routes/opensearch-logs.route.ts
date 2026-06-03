import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { queryLogs, getDeployAggregation } from "../../opensearch/opensearch-log.service"
import type { LogLevel } from "../../opensearch/opensearch.types"

export const opensearchLogsRoutes = new Elysia({ prefix: "/deploy" })
  .get(
    "/logs/:tenantSlug/search",
    async ({ params, query, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const result = await queryLogs({
        tenantSlug: params.tenantSlug,
        query: query.q as string | undefined,
        level: query.level as LogLevel | undefined,
        stackId: query.stackId as string | undefined,
        container: query.container as string | undefined,
        from: query.from as string | undefined,
        to: query.to as string | undefined,
        fromOffset: query.fromOffset ? parseInt(query.fromOffset as string, 10) : undefined,
        size: query.size ? parseInt(query.size as string, 10) : undefined,
      })

      return { ok: true, data: result }
    },
    {
      params: t.Object({ tenantSlug: t.String() }),
      query: t.Optional(
        t.Object({
          q: t.Optional(t.String()),
          level: t.Optional(t.String()),
          stackId: t.Optional(t.String()),
          container: t.Optional(t.String()),
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
          fromOffset: t.Optional(t.String()),
          size: t.Optional(t.String()),
        })
      ),
    }
  )
  .get(
    "/logs/:tenantSlug/aggregation",
    async ({ params, query, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const result = await getDeployAggregation(
        params.tenantSlug,
        query.from as string | undefined,
        query.to as string | undefined
      )

      return { ok: true, data: result }
    },
    {
      params: t.Object({ tenantSlug: t.String() }),
      query: t.Optional(
        t.Object({
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
        })
      ),
    }
  )
