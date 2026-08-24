import { prisma } from "@/lib/prisma"
import { syncCronJobDefinitions } from "@/lib/cron/registry"
import { withCronTelemetry } from "@/lib/cron/telemetry"
import { getQueue } from "@/lib/queue/queue-config"
import { scheduledJobsRegistry } from "@/scripts/schedule-runner"
import type { CronExecutionStatus, Prisma } from "@prisma/client"
import {
  toCronJobDefinitionDTO,
  toCronJobExecutionDTO,
  type CronJobDefinitionDTO,
  type CronJobExecutionDTO,
  type CronSystemMetricsDTO,
} from "../dto/cronjob.dto"
export class CronAdminService {
  private static lastSyncedAt = 0

  async listJobs(): Promise<{
    jobs: CronJobDefinitionDTO[]
    metrics: CronSystemMetricsDTO
  }> {
    // Only sync definitions if TTL has expired (5 mins)
    if (
      !CronAdminService.lastSyncedAt ||
      Date.now() - CronAdminService.lastSyncedAt > 300_000
    ) {
      await syncCronJobDefinitions()
      CronAdminService.lastSyncedAt = Date.now()
    }

    const jobs = await prisma.cronJobDefinition.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    })

    const metrics: CronSystemMetricsDTO = {
      totalJobs: jobs.length,
      healthyJobs: jobs.filter((j) => j.lastStatus === "HEALTHY").length,
      failingJobs: jobs.filter(
        (j) => j.lastStatus === "FAILED" || j.lastStatus === "MISSED"
      ).length,
      runningJobs: jobs.filter((j) => j.lastStatus === "RUNNING").length,
    }

    return {
      jobs: jobs.map(toCronJobDefinitionDTO),
      metrics,
    }
  }

  async getJob(code: string): Promise<CronJobDefinitionDTO | null> {
    const job = await prisma.cronJobDefinition.findUnique({
      where: { code },
    })
    return job ? toCronJobDefinitionDTO(job) : null
  }

  async listExecutions(params: {
    jobCode?: string
    status?: string
    limit?: number
    page?: number
  }): Promise<{
    executions: CronJobExecutionDTO[]
    total: number
    page: number
    limit: number
  }> {
    const page = Math.max(1, params.page ?? 1)
    const limit = Math.min(100, Math.max(1, params.limit ?? 20))
    const skip = (page - 1) * limit

    const where: Prisma.CronJobExecutionWhereInput = {}
    if (params.jobCode) {
      where.cronJob = { code: params.jobCode }
    }
    if (params.status && params.status !== "ALL") {
      where.status = params.status as CronExecutionStatus
    }

    const [total, executions] = await Promise.all([
      prisma.cronJobExecution.count({ where }),
      prisma.cronJobExecution.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip,
        take: limit,
      }),
    ])

    return {
      executions: executions.map(toCronJobExecutionDTO),
      total,
      page,
      limit,
    }
  }

  async getExecution(executionId: string): Promise<CronJobExecutionDTO | null> {
    const execution = await prisma.cronJobExecution.findUnique({
      where: { id: executionId },
    })
    return execution ? toCronJobExecutionDTO(execution) : null
  }

  async triggerJob(params: {
    code: string
    triggeredBy?: string
    reason?: string
  }): Promise<{ success: boolean; message: string }> {
    const def = scheduledJobsRegistry.find((j) => j.name === params.code)

    if (!def) {
      throw new Error(
        `Job definition '${params.code}' is not dispatchable via queue.`
      )
    }

    const now = new Date()
    const queue = getQueue(def.queueName)
    const jobId = `manual-${def.name}-${Date.now()}`

    await withCronTelemetry(
      def.name,
      async (ctx) => {
        ctx.log(
          `Manual trigger initiated by ${params.triggeredBy || "admin"}. Reason: ${params.reason || "N/A"}`
        )
        await queue.add(
          def.jobName,
          {
            ...(def.payload || {}),
            scheduledAt: now.toISOString(),
            isManual: true,
            reason: params.reason,
          },
          { jobId, removeOnComplete: 1000, removeOnFail: 5000 }
        )
        return { triggeredManually: true, queue: def.queueName, jobId }
      },
      {
        triggerType: "MANUAL_PORTAL",
        triggeredBy: params.triggeredBy,
        triggerReason: params.reason,
      }
    )

    return {
      success: true,
      message: `Triggered ${def.name} successfully on queue ${def.queueName}`,
    }
  }
}
