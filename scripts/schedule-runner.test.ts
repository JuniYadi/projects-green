import { describe, expect, mock, test } from "bun:test"

mock.module("@/lib/cron/telemetry", () => ({
  withCronTelemetry: async (
    _name: string,
    fn: (logger: {
      log: (...args: unknown[]) => void
      warn: (...args: unknown[]) => void
      error: (...args: unknown[]) => void
    }) => Promise<unknown>
  ) => fn({ log: () => {}, warn: () => {}, error: () => {} }),
}))

// Mock queue-config
const mockAdd = mock(async () => ({ id: "job-123" }))
const mockGetQueue = mock(() => ({
  add: mockAdd,
}))

mock.module("@/lib/queue/queue-config", () => ({
  getQueue: mockGetQueue,
}))

import { CRON_JOB_DEFINITIONS } from "@/lib/cron/registry"
import { scheduledJobsRegistry, dispatchScheduledJobs } from "./schedule-runner"
describe("schedule-runner", () => {
  test("scheduledJobsRegistry contains all required scheduled operations", () => {
    expect(scheduledJobsRegistry.length).toBeGreaterThanOrEqual(14)
    const names = scheduledJobsRegistry.map((j) => j.name)
    expect(names).toContain("deploy-monitor")
    expect(names).toContain("vpn-reconciliation")
    expect(names).toContain("whatsapp-hourly-billing")
    expect(names).toContain("daily-count-cleanup")
    expect(names).toContain("monthly-billing-finalization")
  })

  test("every scheduled job has a cron definition", () => {
    const definedCodes = new Set(
      CRON_JOB_DEFINITIONS.map((definition) => definition.code)
    )

    for (const job of scheduledJobsRegistry) {
      expect(definedCodes).toContain(job.name)
    }
  })

  test("dispatchScheduledJobs enqueues jobs matching the minute", async () => {
    mockAdd.mockClear()
    // At minute 0 on 1st of Month at 00:00 UTC
    const date = new Date("2026-09-01T00:00:00Z")
    const result = await dispatchScheduledJobs(date)

    expect(result.failed.length).toBe(0)
    expect(result.dispatched).toContain("deploy-monitor")
    expect(result.dispatched).toContain("daily-count-cleanup")
    expect(result.dispatched).toContain("monthly-count-cleanup")
    expect(mockAdd).toHaveBeenCalled()
  })

  test("deterministic jobIds prevent collisions across different scheduled times", () => {
    const job = scheduledJobsRegistry.find((j) => j.name === "deploy-monitor")!
    const d1 = new Date("2026-08-23T07:15:00Z")
    const d2 = new Date("2026-08-23T07:16:00Z")
    expect(job.buildJobId(d1)).not.toBe(job.buildJobId(d2))
  })

  test("all scheduled jobs generate jobIds without colons to satisfy BullMQ validation", () => {
    const sampleDate = new Date("2026-08-23T19:39:12.525Z")
    for (const job of scheduledJobsRegistry) {
      const jobId = job.buildJobId(sampleDate)
      expect(jobId).not.toContain(":")
      expect(typeof jobId).toBe("string")
      expect(jobId.length).toBeGreaterThan(0)
    }
  })
})
