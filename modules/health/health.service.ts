import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"

let startupComplete = false

/** Called once the server is ready to serve traffic. */
export function markStartupComplete(): void {
  startupComplete = true
}

/** Startup probe – server has finished initialising. */
export function checkStartup(): boolean {
  return startupComplete
}

/** Liveness probe – process is alive. */
export function checkLiveness(): boolean {
  return true
}

/**
 * Readiness probe – verifies that critical dependencies are reachable.
 *
 * Returns a summary object with per-dependency status so operators can
 * pinpoint failures without digging into logs.
 */
export async function checkReadiness(): Promise<{
  ok: boolean
  checks: { database: "healthy" | "unhealthy"; redis: "healthy" | "unhealthy" }
}> {
  let database: "healthy" | "unhealthy" = "unhealthy"
  let redisStatus: "healthy" | "unhealthy" = "unhealthy"

  try {
    await prisma.$queryRaw`SELECT 1`
    database = "healthy"
  } catch {
    database = "unhealthy"
  }

  try {
    await redis.ping()
    redisStatus = "healthy"
  } catch {
    redisStatus = "unhealthy"
  }

  return {
    ok: database === "healthy" && redisStatus === "healthy",
    checks: { database, redis: redisStatus },
  }
}
