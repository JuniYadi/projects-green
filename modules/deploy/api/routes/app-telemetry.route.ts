import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { fetchNamespaceTelemetry } from "@/modules/deploy/prometheus-telemetry.service"

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
      const timeRange = (query.range ?? "1h") as "1h" | "6h" | "24h" | "7d"
      const clusterCode = query.cluster ?? "sgp"
      const data = await fetchNamespaceTelemetry({
        organizationId: auth.organizationId,
        timeRange,
        clusterCode,
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
      range: t.Optional(
        t.Union([
          t.Literal("1h"),
          t.Literal("6h"),
          t.Literal("24h"),
          t.Literal("7d"),
        ])
      ),
      cluster: t.Optional(t.String()),
    }),
  }
)
