import { describe, expect, test, mock, beforeEach } from "bun:test"
import {
  CRON_JOB_DEFINITIONS,
  syncCronJobDefinitions,
} from "@/lib/cron/registry"
import { withCronTelemetry } from "@/lib/cron/telemetry"
import { CronAdminService } from "@/modules/admin/api/services/cron-admin.service"
interface MockDefinition {
  id?: string
  code: string
  name: string
  description?: string | null
  category: string
  cronExpression: string
  timezone?: string
  timeoutSeconds?: number
  gracePeriodMins?: number
  isEnabled?: boolean
}

interface MockExecutionData {
  cronJobId: string
  status: string
  triggerType?: string
  triggeredBy?: string | null
  triggerReason?: string | null
  podName?: string | null
}

// Mock Prisma
const mockPrisma = {
  cronJobDefinition: {
    upsert: mock(async ({ create }: { create: MockDefinition }) => ({
      id: "job_1",
      ...create,
      lastStatus: "HEALTHY",
      lastRunAt: null,
      nextRunAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findUnique: mock(async ({ where }: { where: { code: string } }) => ({
      id: "job_1",
      code: where.code,
      name: "Monthly Billing",
      description: "Billing description",
      category: "billing",
      cronExpression: "0 0 1 * *",
      timezone: "UTC",
      timeoutSeconds: 3600,
      gracePeriodMins: 15,
      isEnabled: true,
      lastStatus: "HEALTHY",
      lastRunAt: null,
      nextRunAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findMany: mock(async () => [
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
        lastRunAt: new Date(),
        nextRunAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    update: mock(async ({ data }: { data: Record<string, unknown> }) => data),
  },
  cronJobExecution: {
    create: mock(async ({ data }: { data: MockExecutionData }) => ({
      id: "exec_123",
      ...data,
      startedAt: new Date(),
      createdAt: new Date(),
    })),
    update: mock(async ({ data }: { data: Record<string, unknown> }) => data),
    count: mock(async () => 1),
    findMany: mock(async () => [
      {
        id: "exec_123",
        cronJobId: "job_1",
        status: "SUCCESS",
        triggerType: "SCHEDULED_K8S",
        triggeredBy: null,
        triggerReason: null,
        podName: "pod-1",
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 1200,
        summary: { processed: 10 },
        errorMessage: null,
        errorStack: null,
        logTail: "Completed",
        createdAt: new Date(),
      },
    ]),
    findUnique: mock(async () => ({
      id: "exec_123",
      cronJobId: "job_1",
      status: "SUCCESS",
      triggerType: "SCHEDULED_K8S",
      triggeredBy: null,
      triggerReason: null,
      podName: "pod-1",
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 1200,
      summary: { processed: 10 },
      errorMessage: null,
      errorStack: null,
      logTail: "Completed",
      createdAt: new Date(),
    })),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("Cron Telemetry & Registry", () => {
  beforeEach(() => {
    mockPrisma.cronJobDefinition.upsert.mockClear()
    mockPrisma.cronJobExecution.create.mockClear()
    mockPrisma.cronJobExecution.update.mockClear()
  })

  test("syncCronJobDefinitions syncs all defined cronjobs to database", async () => {
    const synced = await syncCronJobDefinitions()
    expect(synced.length).toBe(CRON_JOB_DEFINITIONS.length)
    expect(mockPrisma.cronJobDefinition.upsert).toHaveBeenCalledTimes(
      CRON_JOB_DEFINITIONS.length
    )
  })

  test("withCronTelemetry logs execution and marks success", async () => {
    const result = await withCronTelemetry(
      "monthly-billing-finalization",
      async (ctx) => {
        ctx.log("Processing subscriptions...")
        return { finalized: 5 }
      }
    )

    expect(result).toEqual({ finalized: 5 })
    expect(mockPrisma.cronJobExecution.create).toHaveBeenCalled()
    expect(mockPrisma.cronJobExecution.update).toHaveBeenCalled()
  })

  test("CronAdminService listJobs and listExecutions work correctly", async () => {
    const service = new CronAdminService()
    const { jobs, metrics } = await service.listJobs()

    expect(jobs.length).toBe(1)
    expect(metrics.totalJobs).toBe(1)
    expect(metrics.healthyJobs).toBe(1)

    const execs = await service.listExecutions({})
    expect(execs.executions.length).toBe(1)
    expect(execs.executions[0].status).toBe("SUCCESS")
  })
})
