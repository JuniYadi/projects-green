import { beforeEach, describe, expect, it } from "bun:test"
import { webhookMetrics } from "./webhook-metrics.service"

describe("WebhookMetricsCollector", () => {
  beforeEach(() => {
    webhookMetrics.reset()
  })

  it("initializes with zero counters and clean snapshot", () => {
    const metrics = webhookMetrics.getMetrics()
    expect(metrics).toEqual({
      totalRequests: 0,
      hmacFailures: 0,
      duplicateEvents: 0,
      processingErrors: 0,
      queueDepth: 0,
      failureRate: 0,
      windowRequests: 0,
      windowErrors: 0,
    })
    expect(webhookMetrics.getAlerts()).toEqual([])
  })

  it("increments counters and calculates sliding window failure rate correctly", () => {
    webhookMetrics.incrementTotalRequests()
    webhookMetrics.incrementTotalRequests()
    webhookMetrics.incrementTotalRequests()
    webhookMetrics.incrementTotalRequests()
    webhookMetrics.incrementHmacFailures()
    webhookMetrics.incrementProcessingErrors()
    webhookMetrics.incrementDuplicateEvents()
    webhookMetrics.setQueueDepth(15)

    const metrics = webhookMetrics.getMetrics()
    expect(metrics.totalRequests).toBe(4)
    expect(metrics.hmacFailures).toBe(1)
    expect(metrics.processingErrors).toBe(1)
    expect(metrics.duplicateEvents).toBe(1)
    expect(metrics.queueDepth).toBe(15)
    expect(metrics.windowRequests).toBe(4)
    expect(metrics.windowErrors).toBe(2)
    // 2 errors / 4 requests = 50%
    expect(metrics.failureRate).toBe(50)
  })

  it("returns critical alert when failure rate exceeds 5% threshold", () => {
    // 20 requests, 2 errors = 10% failure rate > 5% threshold
    for (let i = 0; i < 20; i++) {
      webhookMetrics.incrementTotalRequests()
    }
    webhookMetrics.incrementProcessingErrors()
    webhookMetrics.incrementHmacFailures()

    const alerts = webhookMetrics.getAlerts()
    expect(alerts.length).toBe(1)
    expect(alerts[0].severity).toBe("critical")
    expect(alerts[0].message).toContain(
      "Webhook failure rate (10%) exceeds threshold (5%)"
    )
  })

  it("does not alert when failure rate is below threshold", () => {
    // 100 requests, 1 error = 1% failure rate <= 5%
    for (let i = 0; i < 100; i++) {
      webhookMetrics.incrementTotalRequests()
    }
    webhookMetrics.incrementProcessingErrors()

    const alerts = webhookMetrics.getAlerts()
    expect(alerts).toEqual([])
  })

  it("resets all counters and timestamps on reset()", () => {
    webhookMetrics.incrementTotalRequests()
    webhookMetrics.incrementHmacFailures()
    webhookMetrics.setQueueDepth(5)
    webhookMetrics.reset()

    const metrics = webhookMetrics.getMetrics()
    expect(metrics.totalRequests).toBe(0)
    expect(metrics.hmacFailures).toBe(0)
    expect(metrics.queueDepth).toBe(0)
    expect(metrics.windowRequests).toBe(0)
  })
})
