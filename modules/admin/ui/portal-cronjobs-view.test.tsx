import { describe, expect, test, mock, beforeEach } from "bun:test"
import { render, screen, waitFor } from "@testing-library/react"
import { CronJobsManagementView } from "@/modules/admin/ui/portal-cronjobs-view"

// Mock fetch globally
const mockFetch = mock(async (url: string) => {
  if (url.includes("/api/admin/cronjobs/executions")) {
    return {
      ok: true,
      json: async () => ({
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
      }),
    }
  }

  return {
    ok: true,
    json: async () => ({
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
    }),
  }
})

global.fetch = mockFetch as unknown as typeof fetch

describe("CronJobsManagementView UI Component", () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  test("renders metrics and cronjob table in overview tab", async () => {
    render(<CronJobsManagementView />)

    expect(screen.getByText("CronJob & Worker Monitoring")).toBeDefined()
    expect(screen.getByText("Registered Schedulers")).toBeDefined()

    await waitFor(() => {
      expect(screen.getByText("Monthly Billing Finalization")).toBeDefined()
      expect(screen.getByText("monthly-billing-finalization")).toBeDefined()
      expect(screen.getByText("0 3 1 * *")).toBeDefined()
    })
  })
})
