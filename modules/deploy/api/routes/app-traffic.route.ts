import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { prisma } from "@/lib/prisma"
import { getPlatformRoleForUser } from "@/lib/platform-role"
import {
  getAppTrafficReport,
  getLiveTrafficLogs,
  getAppTrafficIps,
  getAppTrafficIpDetail,
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
  .get(
    "/:slug/traffic/ips",
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

      const page = query?.page ? parseInt(query.page, 10) : 1
      const limit = query?.limit ? parseInt(query.limit, 10) : 10
      const minRequests = query?.minRequests
        ? parseInt(query.minRequests, 10)
        : undefined

      try {
        const result = await getAppTrafficIps(params.slug, {
          granularity: query?.granularity as
            "daily" | "monthly" | "yearly" | undefined,
          date: query?.date,
          month: query?.month,
          year: query?.year,
          page: Number.isFinite(page) ? page : 1,
          limit: Number.isFinite(limit) ? limit : 10,
          search: query?.search,
          signal: query?.signal as
            | "likely_human"
            | "mixed"
            | "likely_automated"
            | "unknown"
            | undefined,
          statusFamily: query?.statusFamily as
            "2xx" | "3xx" | "4xx" | "5xx" | undefined,
          country: query?.country,
          minRequests: Number.isFinite(minRequests) ? minRequests : undefined,
          sortBy: query?.sortBy as
            | "requests"
            | "2xx"
            | "4xx"
            | "5xx"
            | "success"
            | "lastSeen"
            | undefined,
          sortDir: query?.sortDir as "asc" | "desc" | undefined,
        })

        return {
          ok: true,
          data: result,
        }
      } catch (err) {
        set.status = 500
        return {
          ok: false,
          error: "TRAFFIC_IPS_FAILED",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load traffic IPs investigation",
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
          page: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          search: t.Optional(t.String()),
          signal: t.Optional(
            t.Union([
              t.Literal("likely_human"),
              t.Literal("mixed"),
              t.Literal("likely_automated"),
              t.Literal("unknown"),
            ])
          ),
          statusFamily: t.Optional(
            t.Union([
              t.Literal("2xx"),
              t.Literal("3xx"),
              t.Literal("4xx"),
              t.Literal("5xx"),
            ])
          ),
          country: t.Optional(t.String()),
          minRequests: t.Optional(t.String()),
          sortBy: t.Optional(
            t.Union([
              t.Literal("requests"),
              t.Literal("2xx"),
              t.Literal("4xx"),
              t.Literal("5xx"),
              t.Literal("success"),
              t.Literal("lastSeen"),
            ])
          ),
          sortDir: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
        })
      ),
    }
  )
  .get(
    "/:slug/traffic/ips/:ip",
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
        const detail = await getAppTrafficIpDetail(params.slug, params.ip, {
          granularity: query?.granularity as
            "daily" | "monthly" | "yearly" | undefined,
          date: query?.date,
          month: query?.month,
          year: query?.year,
        })

        return {
          ok: true,
          data: detail,
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load IP detail"
        const isBadIp = message.includes("Invalid IP address")
        set.status = isBadIp ? 400 : 500
        return {
          ok: false,
          error: isBadIp ? "INVALID_IP_ADDRESS" : "TRAFFIC_IP_DETAIL_FAILED",
          message,
        }
      }
    },
    {
      params: t.Object({
        slug: t.String(),
        ip: t.String(),
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
