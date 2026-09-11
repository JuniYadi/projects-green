import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  getAppTrafficReport,
  getLiveTrafficLogs,
} from "../../opensearch/opensearch-traffic.service"

export const appTrafficRoutes = new Elysia({ prefix: "/deploy/apps" })
  .get(
    "/:slug/traffic/report",
    async ({ params, query, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser({
        id: auth.user.id,
        email: auth.user.email,
      })

      const stack = await prisma.applicationStack.findFirst({
        where: {
          slug: params.slug,
          ...(platformRole === "super_admin"
            ? {}
            : { organizationId: auth.organizationId ?? "__invalid__" }),
        },
        select: { id: true, slug: true },
      })

      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application stack not found",
        }
      }

      try {
        const report = await getAppTrafficReport(params.slug, {
          granularity: query?.granularity as
            "daily" | "monthly" | "yearly" | undefined,
          date: query?.date,
          month: query?.month,
          year: query?.year,
        })

        return {
          ok: true,
          data: report,
        }
      } catch (err) {
        set.status = 500
        return {
          ok: false,
          error: "TRAFFIC_REPORT_FAILED",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load traffic report",
        }
      }
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
      query: t.Optional(
        t.Object({
          granularity: t.Optional(
            t.Union([
              t.Literal("daily"),
              t.Literal("monthly"),
              t.Literal("yearly"),
            ])
          ),
          date: t.Optional(t.String()),
          month: t.Optional(t.String()),
          year: t.Optional(t.String()),
        })
      ),
    }
  )
  .get(
    "/:slug/traffic/logs",
    async ({ params, query, set }) => {
      const auth = await withAuth()
      if (!auth.user) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
      }

      const platformRole = await getPlatformRoleForUser({
        id: auth.user.id,
        email: auth.user.email,
      })

      const stack = await prisma.applicationStack.findFirst({
        where: {
          slug: params.slug,
          ...(platformRole === "super_admin"
            ? {}
            : { organizationId: auth.organizationId ?? "__invalid__" }),
        },
        select: { id: true, slug: true },
      })

      if (!stack) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Application stack not found",
        }
      }

      const parsedLimit = query?.limit ? parseInt(query.limit, 10) : 25
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : 25
      const status = query?.status as "all" | "2xx" | "4xx" | "5xx" | undefined

      try {
        const result = await getLiveTrafficLogs(params.slug, {
          limit,
          since: query?.since,
          status,
        })

        return {
          ok: true,
          data: result.logs,
          total: result.total,
        }
      } catch (err) {
        set.status = 500
        return {
          ok: false,
          error: "TRAFFIC_LOGS_FAILED",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load live traffic logs",
        }
      }
    },
    {
      params: t.Object({
        slug: t.String(),
      }),
      query: t.Optional(
        t.Object({
          limit: t.Optional(t.String()),
          since: t.Optional(t.String()),
          status: t.Optional(
            t.Union([
              t.Literal("all"),
              t.Literal("2xx"),
              t.Literal("4xx"),
              t.Literal("5xx"),
            ])
          ),
        })
      ),
    }
  )
