import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { CronExecutionStatus } from "@prisma/client"

// ── Mock Dependencies ──────────────────────────────────────────────────────────

const mockSyncCronJobDefinitions = mock(async () => {})
const mockWithCronTelemetry = mock(
  async (
    jobCode: string,
    runnerFn: (ctx: { log: (msg: string) => void }) => Promise<unknown>,
    _options?: unknown
  ) => {
    const ctx = { log: mock(() => {}) }
    return runnerFn(ctx)
  }
)

const mockQueueAdd = mock(async () => {})
const mockGetQueue = mock((_queueName: string) => ({
  add: mockQueueAdd,
}))

const mockFindManyCronJobDefinition = mock(async () => [])
const mockFindUniqueCronJobDefinition = mock(async () => null)
const mockFindManyCronJobExecution = mock(async () => [])
const mockFindUniqueCronJobExecution = mock(async () => null)
const mockCountCronJobExecution = mock(async () => 0)

mock.module("@/lib/cron/registry", () => ({
  syncCronJobDefinitions: mockSyncCronJobDefinitions,
}))

mock.module("@/lib/cron/telemetry", () => ({
  withCronTelemetry: mockWithCronTelemetry,
}))

mock.module("@/lib/queue/queue-config", () => ({
  getQueue: mockGetQueue,
}))

mock.module("@/lib/prisma", () => ({
  prisma: {
    cronJobDefinition: {
      findMany: mockFindManyCronJobDefinition,
      findUnique: mockFindUniqueCronJobDefinition,
    },
    cronJobExecution: {
      findMany: mockFindManyCronJobExecution,
      findUnique: mockFindUniqueCronJobExecution,
      count: mockCountCronJobExecution,
    },
  },
}))

// Import service under test after module mocks are configured
import { CronAdminService } from "./cron-admin.service"

describe("CronAdminService", () => {
  let service: CronAdminService

  beforeEach(() => {
    mockSyncCronJobDefinitions.mockClear()
    mockWithCronTelemetry.mockClear()
    mockQueueAdd.mockClear()
    mockGetQueue.mockClear()
    mockFindManyCronJobDefinition.mockClear()
    mockFindUniqueCronJobDefinition.mockClear()
    mockFindManyCronJobExecution.mockClear()
    mockFindUniqueCronJobExecution.mockClear()
    mockCountCronJobExecution.mockClear()

    service = new CronAdminService()
    // Reset private static lastSyncedAt if needed across runs
    ;(CronAdminService as unknown as { lastSyncedAt: number }).lastSyncedAt = 0
  })

  describe("listJobs", () => {
    it("syncs job definitions when TTL has expired and returns mapped DTOs with system metrics", async () => {
      const sampleJobs = [
        {
          id: "job-1",
          code: "deploy-monitor",
          name: "Deploy Monitor",
          description: "Monitors deployments",
          category: "system",
          cronExpression: "* * * * *",
          timezone: "UTC",
          timeoutSeconds: 120,
          gracePeriodMins: 2,
          isEnabled: true,
          lastStatus: "HEALTHY",
          lastRunAt: new Date("2026-08-28T00:00:00.000Z"),
          nextRunAt: new Date("2026-08-28T00:01:00.000Z"),
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        {
          id: "job-2",
          code: "vpn-reconciliation",
          name: "VPN Reconciliation",
          description: null,
          category: "vpn",
          cronExpression: "*/5 * * * *",
          timezone: "UTC",
          timeoutSeconds: 300,
          gracePeriodMins: 5,
          isEnabled: true,
          lastStatus: "FAILED",
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        {
          id: "job-3",
          code: "whatsapp-health",
          name: "WhatsApp Health",
          description: null,
          category: "whatsapp",
          cronExpression: "*/5 * * * *",
          timezone: "UTC",
          timeoutSeconds: 300,
          gracePeriodMins: 5,
          isEnabled: true,
          lastStatus: "MISSED",
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        {
          id: "job-4",
          code: "billing-reset",
          name: "Billing Reset",
          description: null,
          category: "billing",
          cronExpression: "0 0 * * *",
          timezone: "UTC",
          timeoutSeconds: 600,
          gracePeriodMins: 10,
          isEnabled: true,
          lastStatus: "RUNNING",
          lastRunAt: null,
          nextRunAt: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ]

      mockFindManyCronJobDefinition.mockResolvedValueOnce(sampleJobs)

      const result = await service.listJobs()

      expect(mockSyncCronJobDefinitions).toHaveBeenCalledTimes(1)
      expect(mockFindManyCronJobDefinition).toHaveBeenCalledWith({
        orderBy: [{ category: "asc" }, { name: "asc" }],
      })

      expect(result.jobs).toHaveLength(4)
      expect(result.jobs[0].code).toBe("deploy-monitor")
      expect(result.jobs[0].lastRunAt).toBe("2026-08-28T00:00:00.000Z")

      expect(result.metrics).toEqual({
        totalJobs: 4,
        healthyJobs: 1,
        failingJobs: 2, // FAILED and MISSED
        runningJobs: 1, // RUNNING
      })
    })

    it("skips syncCronJobDefinitions if called within TTL (5 minutes)", async () => {
      mockFindManyCronJobDefinition.mockResolvedValue([])

      // First call triggers sync
      await service.listJobs()
      expect(mockSyncCronJobDefinitions).toHaveBeenCalledTimes(1)

      // Second immediate call within 300,000ms skips sync
      await service.listJobs()
      expect(mockSyncCronJobDefinitions).toHaveBeenCalledTimes(1)
    })
  })

  describe("getJob", () => {
    it("returns null when job definition is not found", async () => {
      mockFindUniqueCronJobDefinition.mockResolvedValueOnce(null)

      const job = await service.getJob("non-existent")

      expect(job).toBeNull()
      expect(mockFindUniqueCronJobDefinition).toHaveBeenCalledWith({
        where: { code: "non-existent" },
      })
    })

    it("returns mapped CronJobDefinitionDTO when found", async () => {
      mockFindUniqueCronJobDefinition.mockResolvedValueOnce({
        id: "job-123",
        code: "deploy-monitor",
        name: "Deploy Monitor",
        description: "Deploy status monitor",
        category: "system",
        cronExpression: "* * * * *",
        timezone: "UTC",
        timeoutSeconds: 120,
        gracePeriodMins: 2,
        isEnabled: true,
        lastStatus: "HEALTHY",
        lastRunAt: new Date("2026-08-28T10:00:00.000Z"),
        nextRunAt: null,
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:00:00.000Z"),
      })

      const job = await service.getJob("deploy-monitor")

      expect(job).not.toBeNull()
      expect(job?.id).toBe("job-123")
      expect(job?.code).toBe("deploy-monitor")
      expect(job?.lastRunAt).toBe("2026-08-28T10:00:00.000Z")
      expect(job?.nextRunAt).toBeNull()
    })
  })

  describe("listExecutions", () => {
    it("paginates executions and applies jobCode / status filters", async () => {
      const sampleExecution = {
        id: "exec-1",
        cronJobId: "job-1",
        status: "SUCCESS" as CronExecutionStatus,
        triggerType: "MANUAL_PORTAL",
        triggeredBy: "admin@example.com",
        triggerReason: "Ad-hoc sync",
        podName: "runner-pod",
        startedAt: new Date("2026-08-28T12:00:00.000Z"),
        finishedAt: new Date("2026-08-28T12:01:00.000Z"),
        durationMs: 60000,
        summary: { processed: 42 },
        errorMessage: null,
        errorStack: null,
        logTail: "Log line 1\nLog line 2",
        createdAt: new Date("2026-08-28T12:00:00.000Z"),
      }

      mockCountCronJobExecution.mockResolvedValueOnce(25)
      mockFindManyCronJobExecution.mockResolvedValueOnce([sampleExecution])

      const result = await service.listExecutions({
        jobCode: "deploy-monitor",
        status: "SUCCESS",
        page: 2,
        limit: 10,
      })

      expect(mockCountCronJobExecution).toHaveBeenCalledWith({
        where: {
          cronJob: { code: "deploy-monitor" },
          status: "SUCCESS",
        },
      })

      expect(mockFindManyCronJobExecution).toHaveBeenCalledWith({
        where: {
          cronJob: { code: "deploy-monitor" },
          status: "SUCCESS",
        },
        orderBy: { startedAt: "desc" },
        skip: 10,
        take: 10,
      })

      expect(result.total).toBe(25)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(10)
      expect(result.executions).toHaveLength(1)
      expect(result.executions[0].id).toBe("exec-1")
      expect(result.executions[0].summary).toEqual({ processed: 42 })
    })

    it("clamps limit and ignores status when 'ALL'", async () => {
      mockCountCronJobExecution.mockResolvedValueOnce(0)
      mockFindManyCronJobExecution.mockResolvedValueOnce([])

      const result = await service.listExecutions({
        status: "ALL",
        limit: 500, // should clamp to 100
        page: -5, // should clamp to 1
      })

      expect(result.limit).toBe(100)
      expect(result.page).toBe(1)
      expect(mockCountCronJobExecution).toHaveBeenCalledWith({
        where: {},
      })
    })
  })

  describe("getExecution", () => {
    it("returns null when execution is not found", async () => {
      mockFindUniqueCronJobExecution.mockResolvedValueOnce(null)

      const result = await service.getExecution("exec-999")

      expect(result).toBeNull()
      expect(mockFindUniqueCronJobExecution).toHaveBeenCalledWith({
        where: { id: "exec-999" },
      })
    })

    it("returns mapped CronJobExecutionDTO when found", async () => {
      mockFindUniqueCronJobExecution.mockResolvedValueOnce({
        id: "exec-100",
        cronJobId: "job-1",
        status: "FAILED",
        triggerType: "SCHEDULED_K8S",
        triggeredBy: null,
        triggerReason: null,
        podName: null,
        startedAt: new Date("2026-08-28T05:00:00.000Z"),
        finishedAt: null,
        durationMs: null,
        summary: "invalid json string", // tests fallback when not object
        errorMessage: "Timeout error",
        errorStack: "Error at line 12",
        logTail: "failed",
        createdAt: new Date("2026-08-28T05:00:00.000Z"),
      })

      const result = await service.getExecution("exec-100")

      expect(result).not.toBeNull()
      expect(result?.id).toBe("exec-100")
      expect(result?.status).toBe("FAILED")
      expect(result?.summary).toBeNull()
      expect(result?.finishedAt).toBeNull()
    })
  })

  describe("triggerJob", () => {
    it("throws an error if job code is not in scheduledJobsRegistry", async () => {
      await expect(
        service.triggerJob({
          code: "unregistered-job-code",
        })
      ).rejects.toThrow(
        "Job definition 'unregistered-job-code' is not dispatchable via queue."
      )
    })

    it("triggers registered job with telemetry and enqueues to BullMQ queue", async () => {
      const result = await service.triggerJob({
        code: "deploy-monitor",
        triggeredBy: "user@example.com",
        reason: "Testing deploy status",
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("Triggered deploy-monitor successfully")

      expect(mockGetQueue).toHaveBeenCalledWith("deploy-monitor")
      expect(mockWithCronTelemetry).toHaveBeenCalledWith(
        "deploy-monitor",
        expect.any(Function),
        {
          triggerType: "MANUAL_PORTAL",
          triggeredBy: "user@example.com",
          triggerReason: "Testing deploy status",
        }
      )
      expect(mockQueueAdd).toHaveBeenCalledWith(
        "check-deploy-status",
        expect.objectContaining({
          scheduledAt: expect.any(String),
          isManual: true,
          reason: "Testing deploy status",
        }),
        expect.objectContaining({
          jobId: expect.stringMatching(/^manual-deploy-monitor-\d+$/),
          removeOnComplete: 1000,
          removeOnFail: 5000,
        })
      )
    })

    it("triggers registered job with default fallback values when triggeredBy/reason are omitted", async () => {
      const result = await service.triggerJob({
        code: "deploy-monitor",
      })

      expect(result.success).toBe(true)
      expect(mockWithCronTelemetry).toHaveBeenCalledWith(
        "deploy-monitor",
        expect.any(Function),
        {
          triggerType: "MANUAL_PORTAL",
          triggeredBy: undefined,
          triggerReason: undefined,
        }
      )
    })
  })
})
