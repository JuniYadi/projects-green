import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { fetchNamespaceTelemetry } from "@/modules/deploy/prometheus-telemetry.service"
import type { PredefinedTimeRange } from "@/lib/time-range"

export const appTelemetryRoutes = new Elysia({
  prefix: "/deploy/telemetry",
}).get(
  "/",
  async ({ query, set }) => {
    const auth = await withAuth()
    if (!auth.user) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Unauthorized" }
    }
    if (!auth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Organization required" }
    }

    try {
      const timeRange = query.range
        ? (query.range as PredefinedTimeRange | "custom")
        : query.from && query.to
          ? "custom"
          : "1h"
      const clusterCode = query.cluster ?? "sgp"
      const data = await fetchNamespaceTelemetry({
        organizationId: auth.organizationId,
        timeRange,
        clusterCode,
        ...(query.from !== undefined ? { from: query.from } : {}),
        ...(query.to !== undefined ? { to: query.to } : {}),
        ...(query.tz !== undefined ? { timeZone: query.tz } : {}),
        ...(query.appSlug !== undefined ? { appSlug: query.appSlug } : {}),
      })
      return { ok: true, data }
    } catch (error) {
      console.error("[Telemetry] Failed to fetch namespace telemetry:", error)
      set.status = 500
      return {
        ok: false,
        error: "TELEMETRY_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to fetch telemetry",
      }
    }
  },
  {
    query: t.Object({
      range: t.Optional(t.String()),
      from: t.Optional(t.String()),
      to: t.Optional(t.String()),
      cluster: t.Optional(t.String()),
      tz: t.Optional(t.String()),
      appSlug: t.Optional(t.String()),
    }),
  }
)
