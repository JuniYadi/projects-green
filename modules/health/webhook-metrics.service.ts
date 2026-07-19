/**
 * Webhook health metrics — in-memory counters, health status, alert triggers.
 *
 * This is a singleton collector that tracks webhook pipeline health across
 * request processing, signature verification, event dispatch, and worker
 * execution. Metrics are kept in-memory (no persistence) and reset on restart.
 *
 * Alert thresholds are hardcoded for now; tune via env vars when needed.
 */

const FAILURE_RATE_WINDOW_MS = 60 * 60_000 // 1 hour
const FAILURE_RATE_THRESHOLD = 0.05 // 5%

class WebhookMetricsCollector {
  private totalRequests = 0
  private hmacFailures = 0
  private duplicateEvents = 0
  private processingErrors = 0
  private queueDepth = 0

  /** Timestamps of requests and errors for sliding-window rate calculation. */
  private requestTimestamps: number[] = []
  private errorTimestamps: number[] = []

  // ── Incrementers ──────────────────────────────────────────────

  incrementTotalRequests(): void {
    this.totalRequests++
    this.requestTimestamps.push(Date.now())
  }

  incrementHmacFailures(): void {
    this.hmacFailures++
    this.errorTimestamps.push(Date.now())
  }

  incrementDuplicateEvents(): void {
    this.duplicateEvents++
  }

  incrementProcessingErrors(): void {
    this.processingErrors++
    this.errorTimestamps.push(Date.now())
  }

  /** Allow external callers (e.g. a periodic poller) to set queue depth. */
  setQueueDepth(depth: number): void {
    this.queueDepth = depth
  }

  // ── Snapshot ──────────────────────────────────────────────────

  getMetrics() {
    const now = Date.now()
    const windowStart = now - FAILURE_RATE_WINDOW_MS

    // Prune old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => ts >= windowStart
    )
    this.errorTimestamps = this.errorTimestamps.filter(
      (ts) => ts >= windowStart
    )

    const windowRequests = this.requestTimestamps.length
    const windowErrors = this.errorTimestamps.length
    const failureRate = windowRequests > 0 ? windowErrors / windowRequests : 0

    return {
      totalRequests: this.totalRequests,
      hmacFailures: this.hmacFailures,
      duplicateEvents: this.duplicateEvents,
      processingErrors: this.processingErrors,
      queueDepth: this.queueDepth,
      failureRate: Math.round(failureRate * 10000) / 100, // percentage with 2 decimals
      windowRequests,
      windowErrors,
    }
  }

  // ── Alerts ───────────────────────────────────────────────────

  getAlerts(): Array<{ severity: "warn" | "critical"; message: string }> {
    const alerts: Array<{ severity: "warn" | "critical"; message: string }> = []

    const now = Date.now()
    const windowStart = now - FAILURE_RATE_WINDOW_MS

    // Prune old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => ts >= windowStart
    )
    this.errorTimestamps = this.errorTimestamps.filter(
      (ts) => ts >= windowStart
    )

    const windowRequests = this.requestTimestamps.length
    const windowErrors = this.errorTimestamps.length

    if (windowRequests > 0) {
      const failureRate = windowErrors / windowRequests
      if (failureRate > FAILURE_RATE_THRESHOLD) {
        alerts.push({
          severity: "critical",
          message: `Webhook failure rate (${Math.round(failureRate * 100)}%) exceeds threshold (${FAILURE_RATE_THRESHOLD * 100}%) in the last hour`,
        })
      }
    }

    return alerts
  }

  /** Reset all counters (useful in tests). */
  reset(): void {
    this.totalRequests = 0
    this.hmacFailures = 0
    this.duplicateEvents = 0
    this.processingErrors = 0
    this.queueDepth = 0
    this.requestTimestamps = []
    this.errorTimestamps = []
  }
}

/** Singleton instance — imported directly by route handlers and workers. */
export const webhookMetrics = new WebhookMetricsCollector()
