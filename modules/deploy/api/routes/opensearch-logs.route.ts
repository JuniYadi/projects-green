import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import { queryLogs, getDeployAggregation } from "../../opensearch/opensearch-log.service"
import type { LogLevel } from "../../opensearch/opensearch.types"

const MAX_PAGE_SIZE = 1000

function parseSize(raw: string | undefined, defaultVal: number): number {
  if (!raw) return defaultVal
  const n = parseInt(raw, 10)
  if (Number.isNaN(n) || n < 1) return defaultVal
  return Math.min(n, MAX_PAGE_SIZE)
}

function isValidISODate(str: string | undefined): string | undefined {
  if (!str) return undefined
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

export const opensearchLogsRoutes = new Elysia({ prefix: "/deploy" })
  .get(
    "/logs/:tenantSlug/search",
    async ({ params, query, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      // Check tenant access: super_admin can access any tenant, others only their own
      const platformRole = await getPlatformRoleForUser({
        id: auth.user.id,
        email: auth.user.email,
      })

      if (platformRole !== "super_admin") {
        const userMeta = (auth.user as unknown as { metadata?: Record<string, string> })?.metadata
        if (!userMeta?.orgSlug || userMeta.orgSlug !== params.tenantSlug) {
          set.status = 403
          return { ok: false, error: "FORBIDDEN", message: "Access denied" }
        }
      }

      const result = await queryLogs({
        tenantSlug: params.tenantSlug,
        query: query.q as string | undefined,
        level: query.level as LogLevel | undefined,
        stackId: query.stackId as string | undefined,
        container: query.container as string | undefined,
        from: isValidISODate(query.from as string | undefined),
        to: isValidISODate(query.to as string | undefined),
        fromOffset: query.fromOffset ? parseInt(query.fromOffset as string, 10) : undefined,
        size: parseSize(query.size as string | undefined, 100),
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

      // Check tenant access: super_admin can access any tenant, others only their own
      const platformRole = await getPlatformRoleForUser({
        id: auth.user.id,
        email: auth.user.email,
      })

      if (platformRole !== "super_admin") {
        const userMeta = (auth.user as unknown as { metadata?: Record<string, string> })?.metadata
        if (!userMeta?.orgSlug || userMeta.orgSlug !== params.tenantSlug) {
          set.status = 403
          return { ok: false, error: "FORBIDDEN", message: "Access denied" }
        }
      }

      const result = await getDeployAggregation(
        params.tenantSlug,
        isValidISODate(query.from as string | undefined),
        isValidISODate(query.to as string | undefined)
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
