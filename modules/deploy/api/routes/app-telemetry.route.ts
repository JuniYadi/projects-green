import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { fetchNamespaceTelemetry } from "@/modules/deploy/prometheus-telemetry.service"
import { prisma } from "@/lib/prisma"
import { resolveContainerLimits } from "@/modules/deploy/deploy.constants"
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
      // An app's limit is known from its plan even when Prometheus has no
      // limit series; without it the service reports a cluster-wide
      // 2 vCPU / 8 GB placeholder as if it were this app's ceiling.
      const stack = query.appSlug
        ? await prisma.applicationStack.findFirst({
            where: { slug: query.appSlug, organizationId: auth.organizationId },
            select: { cpu: true, memory: true },
          })
        : null
      const limits = stack
        ? resolveContainerLimits(stack.cpu, stack.memory)
        : null
      const data = await fetchNamespaceTelemetry({
        organizationId: auth.organizationId,
        timeRange,
        clusterCode,
        ...(query.from !== undefined ? { from: query.from } : {}),
        ...(query.to !== undefined ? { to: query.to } : {}),
        ...(query.tz !== undefined ? { timeZone: query.tz } : {}),
        ...(query.appSlug !== undefined ? { appSlug: query.appSlug } : {}),
        ...(query.view !== undefined
          ? { view: query.view as "all" | "compute" | "ingress" }
          : {}),
        ...(limits
          ? {
              limitsFallback: {
                cpuCores: limits.cpuMillicores / 1000,
                memoryBytes: limits.memoryMi * 1024 * 1024,
              },
            }
          : {}),
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
      view: t.Optional(t.String()),
    }),
  }
)
