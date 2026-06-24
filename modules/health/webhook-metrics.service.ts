/**
 * Webhook health metrics — in-memory counters, health status, alert triggers.
 *
 * This is a singleton collector that tracks webhook pipeline health across
 * request processing, signature verification, event dispatch, and worker
 * execution. Metrics are kept in-memory (no persistence) and reset on restart.
 *
 * Alert thresholds are hardcoded for now; tune via env vars when needed.
 */

const HMAC_FAILURE_WINDOW_MS = 60_000 // 1 minute
const HMAC_FAILURE_THRESHOLD = 10 // alerts if >10 failures in window

class WebhookMetricsCollector {
  private totalRequests = 0
  private hmacFailures = 0
  private duplicateEvents = 0
  private processingErrors = 0
  private queueDepth = 0

  /** Timestamps of recent HMAC failures for sliding-window alerting. */
  private hmacFailureTimestamps: number[] = []

  // ── Incrementers ──────────────────────────────────────────────

  incrementTotalRequests(): void {
    this.totalRequests++
  }

  incrementHmacFailures(): void {
    this.hmacFailures++
    this.hmacFailureTimestamps.push(Date.now())
  }

  incrementDuplicateEvents(): void {
    this.duplicateEvents++
  }

  incrementProcessingErrors(): void {
    this.processingErrors++
  }

  /** Allow external callers (e.g. a periodic poller) to set queue depth. */
  setQueueDepth(depth: number): void {
    this.queueDepth = depth
  }

  // ── Snapshot ──────────────────────────────────────────────────

  getMetrics() {
    return {
      totalRequests: this.totalRequests,
      hmacFailures: this.hmacFailures,
      duplicateEvents: this.duplicateEvents,
      processingErrors: this.processingErrors,
      queueDepth: this.queueDepth,
    }
  }

  // ── Alerts ────────────────────────────────────────────────────

  getAlerts(): Array<{ severity: "warn" | "critical"; message: string }> {
    const alerts: Array<{ severity: "warn" | "critical"; message: string }> = []

    // Sliding-window HMAC failure rate
    const now = Date.now()
    const windowStart = now - HMAC_FAILURE_WINDOW_MS
    // Prune old timestamps
    this.hmacFailureTimestamps = this.hmacFailureTimestamps.filter(
      (ts) => ts >= windowStart
    )

    if (this.hmacFailureTimestamps.length > HMAC_FAILURE_THRESHOLD) {
      alerts.push({
        severity: "critical",
        message: `HMAC signature failures (${this.hmacFailureTimestamps.length}) exceed threshold (${HMAC_FAILURE_THRESHOLD}) in the last 60s`,
      })
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
    this.hmacFailureTimestamps = []
  }
}

/** Singleton instance — imported directly by route handlers and workers. */
export const webhookMetrics = new WebhookMetricsCollector()
