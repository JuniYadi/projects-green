/**
 * Stale session cleanup — marks ACTIVE sessions with no recent ping as STALE.
 *
 * Runs every 5 minutes via Bun timer.
 * Threshold: 15 minutes since lastPingAt.
 */
import { logger } from "@/lib/logger"
import { vpnMobileSessionService } from "./vpn-mobile-session.service"

const CLEANUP_INTERVAL_MS = 5 * 60_000
const STALE_THRESHOLD_MINUTES = 15

let timer: ReturnType<typeof setInterval> | null = null

async function runCleanup() {
  try {
    const count = await vpnMobileSessionService.cleanStale(
      STALE_THRESHOLD_MINUTES
    )
    if (count > 0) {
      logger.info(
        { count, staleThresholdMinutes: STALE_THRESHOLD_MINUTES },
        `[SessionCleanup] Marked ${count} session(s) as STALE`
      )
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "[SessionCleanup] Error during stale session cleanup"
    )
  }
}

/**
 * Start the periodic stale session cleanup.
 * Called once at app startup.
 */
export function startStaleSessionCleanup(): void {
  if (timer) return // already started

  // Run once immediately on startup
  runCleanup()

  timer = setInterval(runCleanup, CLEANUP_INTERVAL_MS)
  logger.info(
    {
      intervalSeconds: CLEANUP_INTERVAL_MS / 1000,
      staleThresholdMinutes: STALE_THRESHOLD_MINUTES,
    },
    "[SessionCleanup] Started"
  )
}

/**
 * Stop the cleanup timer (e.g. for graceful shutdown).
 */
export function stopStaleSessionCleanup(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
    logger.info("[SessionCleanup] Stopped")
  }
}
