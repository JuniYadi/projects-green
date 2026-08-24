import { describe, expect, test, mock, beforeEach } from "bun:test"
import { createAdminCronRoutes } from "@/modules/admin/api/routes/admin-cron.route"

// Mock CronAdminService
const mockListJobs = mock(async () => ({
  jobs: [
    {
      id: "job_1",
      code: "monthly-billing-finalization",
      name: "Monthly Billing Finalization",
      description: "Billing description",
      category: "billing",
      cronExpression: "0 3 1 * *",
      timezone: "UTC",
      timeoutSeconds: 3600,
      gracePeriodMins: 120,
      isEnabled: true,
      lastStatus: "HEALTHY",
      lastRunAt: "2026-08-01T00:00:00.000Z",
      nextRunAt: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  metrics: {
    totalJobs: 1,
    healthyJobs: 1,
    failingJobs: 0,
    runningJobs: 0,
  },
}))

const mockListExecutions = mock(async () => ({
  executions: [
    {
      id: "exec_1",
      cronJobId: "job_1",
      status: "SUCCESS",
      triggerType: "SCHEDULED_K8S",
      triggeredBy: null,
      triggerReason: null,
      podName: "pod-1",
      startedAt: "2026-08-01T00:00:00.000Z",
      finishedAt: "2026-08-01T00:04:00.000Z",
      durationMs: 240000,
      summary: { finalized: 10 },
      errorMessage: null,
      errorStack: null,
      logTail: "Completed",
      createdAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
}))

const mockTriggerJob = mock(async () => ({
  success: true,
  message: "Triggered successfully",
}))

mock.module("@/modules/admin/api/services/cron-admin.service", () => ({
  CronAdminService: class {
    listJobs = mockListJobs
    listExecutions = mockListExecutions
    getExecution = mock(async (id: string) =>
      id === "exec_1"
        ? {
            id: "exec_1",
            cronJobId: "job_1",
            status: "SUCCESS",
            triggerType: "SCHEDULED_K8S",
            triggeredBy: null,
            triggerReason: null,
            podName: "pod-1",
            startedAt: "2026-08-01T00:00:00.000Z",
            finishedAt: "2026-08-01T00:04:00.000Z",
            durationMs: 240000,
            summary: { finalized: 10 },
            errorMessage: null,
            errorStack: null,
            logTail: "Completed",
            createdAt: "2026-08-01T00:00:00.000Z",
          }
        : null
    )
    triggerJob = mockTriggerJob
  },
}))

describe("Admin Cron Routes", () => {
  beforeEach(() => {
    mockListJobs.mockClear()
    mockListExecutions.mockClear()
    mockTriggerJob.mockClear()
  })

  test("GET /admin/cronjobs returns jobs and metrics", async () => {
    const app = createAdminCronRoutes()
    const response = await app.handle(
      new Request("http://localhost/admin/cronjobs")
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.jobs.length).toBe(1)
    expect(json.metrics.healthyJobs).toBe(1)
  })

  test("GET /admin/cronjobs/executions returns paginated executions", async () => {
    const app = createAdminCronRoutes()
    const response = await app.handle(
      new Request("http://localhost/admin/cronjobs/executions?page=1&limit=10")
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.executions.length).toBe(1)
    expect(json.total).toBe(1)
  })

  test("POST /admin/cronjobs/:code/trigger triggers job", async () => {
    const app = createAdminCronRoutes()
    const response = await app.handle(
      new Request(
        "http://localhost/admin/cronjobs/monthly-billing-finalization/trigger",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "Manual test run",
            triggeredBy: "Admin",
          }),
        }
      )
    )

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
  })
})
