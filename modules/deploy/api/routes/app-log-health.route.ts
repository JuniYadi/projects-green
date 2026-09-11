import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  getAppLogReport,
  getAppLogErrorsDrilldown,
} from "../../opensearch/opensearch-log-health.service"

export const appLogHealthRoutes = new Elysia({ prefix: "/deploy/apps" })
  .get(
    "/:slug/logs/report",
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
        const report = await getAppLogReport(params.slug, {
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
          error: "LOG_REPORT_FAILED",
          message:
            err instanceof Error ? err.message : "Failed to load log report",
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
    "/:slug/logs/errors",
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

      const parsedLimit = query?.limit ? parseInt(query.limit, 10) : 50
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : 50

      try {
        const result = await getAppLogErrorsDrilldown(params.slug, {
          limit,
          from: query?.from,
          to: query?.to,
        })

        return {
          ok: true,
          data: result.errors,
          total: result.totalDistinct,
        }
      } catch (err) {
        set.status = 500
        return {
          ok: false,
          error: "LOG_ERRORS_DRILLDOWN_FAILED",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load error drilldown",
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
          from: t.Optional(t.String()),
          to: t.Optional(t.String()),
        })
      ),
    }
  )
