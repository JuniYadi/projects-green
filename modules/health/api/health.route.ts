import { Elysia } from "elysia"
import { healthcheckPlugin } from "elysia-healthcheck"

import {
  checkLiveness,
  checkReadiness,
  checkStartup,
} from "@/modules/health/health.service"
import { webhookMetrics } from "@/modules/health/webhook-metrics.service"

/**
 * Health routes — Kubernetes-convention endpoints via elysia-healthcheck,
 * plus project-specific startup and webhook probes, and Docker-compatible
 * aliases under /health/*.
 *
 * Plugin endpoints (under `/healthz`):
 *   GET /healthz         — overall health + uptime
 *   GET /healthz/live    — liveness probe
 *   GET /healthz/ready   — readiness probe (DB + Redis)
 *
 * Compatibility endpoints (under `/health`):
 *   GET /health/liveness — liveness probe (alias for /healthz/live)
 *   GET /health/readiness — readiness probe (alias for /healthz/ready)
 *   GET /health/startup  — startup probe (server initialized)
 *   GET /health/webhooks — webhook pipeline health
 */
export const healthRoutes = new Elysia()
  .use(
    healthcheckPlugin({
      checks: {
        liveness: [
          () => ({
            name: "app",
            healthy: checkLiveness(),
          }),
        ],
        readiness: [
          async () => {
            const result = await checkReadiness()
            return {
              name: "dependencies",
              healthy: result.ok,
              details: result.checks,
            }
          },
        ],
      },
    })
  )
  .get("/health/liveness", () => ({
    ok: true as const,
    timestamp: new Date().toISOString(),
  }))
  .get("/health/readiness", async () => {
    const result = await checkReadiness()

    if (!result.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          timestamp: new Date().toISOString(),
          checks: result.checks,
        }),
        { status: 503, headers: { "content-type": "application/json" } }
      )
    }

    return {
      ok: true as const,
      timestamp: new Date().toISOString(),
      checks: result.checks,
    }
  })
  .get("/health/startup", () => {
    const ready = checkStartup()

    if (!ready) {
      return new Response(
        JSON.stringify({ ok: false, timestamp: new Date().toISOString() }),
        { status: 503, headers: { "content-type": "application/json" } }
      )
    }

    return { ok: true as const, timestamp: new Date().toISOString() }
  })
  .get("/health/webhooks", () => {
    const metrics = webhookMetrics.getMetrics()
    const alerts = webhookMetrics.getAlerts()
    const healthy = alerts.length === 0

    if (!healthy) {
      return new Response(
        JSON.stringify({
          ok: false,
          timestamp: new Date().toISOString(),
          metrics,
          alerts,
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        }
      )
    }

    return {
      ok: true as const,
      timestamp: new Date().toISOString(),
      metrics,
      alerts,
    }
  })
