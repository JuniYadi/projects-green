import { Elysia } from "elysia"

import {
  checkReadiness,
  checkStartup,
} from "@/modules/health/health.service"

export const healthRoutes = new Elysia()
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
  .get("/health/liveness", () => ({
    ok: true as const,
    timestamp: new Date().toISOString(),
  }))
  .get("/health/healthz", () => ({
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
