import type {
  CronExecutionStatus,
  CronJobDefinition,
  CronJobExecution,
  CronJobStatus,
  CronTriggerType,
} from "@prisma/client"

export interface CronJobDefinitionDTO {
  id: string
  code: string
  name: string
  description: string | null
  category: string
  cronExpression: string
  timezone: string
  timeoutSeconds: number
  gracePeriodMins: number
  isEnabled: boolean
  lastStatus: CronJobStatus
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CronJobExecutionDTO {
  id: string
  cronJobId: string
  status: CronExecutionStatus
  triggerType: CronTriggerType
  triggeredBy: string | null
  triggerReason: string | null
  podName: string | null
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  summary: Record<string, unknown> | null
  errorMessage: string | null
  errorStack: string | null
  logTail: string | null
  createdAt: string
}

export interface CronSystemMetricsDTO {
  totalJobs: number
  healthyJobs: number
  failingJobs: number
  runningJobs: number
}

export const toCronJobDefinitionDTO = (
  entity: CronJobDefinition
): CronJobDefinitionDTO => ({
  id: entity.id,
  code: entity.code,
  name: entity.name,
  description: entity.description,
  category: entity.category,
  cronExpression: entity.cronExpression,
  timezone: entity.timezone,
  timeoutSeconds: entity.timeoutSeconds,
  gracePeriodMins: entity.gracePeriodMins,
  isEnabled: entity.isEnabled,
  lastStatus: entity.lastStatus,
  lastRunAt: entity.lastRunAt ? entity.lastRunAt.toISOString() : null,
  nextRunAt: entity.nextRunAt ? entity.nextRunAt.toISOString() : null,
  createdAt: entity.createdAt.toISOString(),
  updatedAt: entity.updatedAt.toISOString(),
})

export const toCronJobExecutionDTO = (
  entity: CronJobExecution
): CronJobExecutionDTO => ({
  id: entity.id,
  cronJobId: entity.cronJobId,
  status: entity.status,
  triggerType: entity.triggerType,
  triggeredBy: entity.triggeredBy,
  triggerReason: entity.triggerReason,
  podName: entity.podName,
  startedAt: entity.startedAt.toISOString(),
  finishedAt: entity.finishedAt ? entity.finishedAt.toISOString() : null,
  durationMs: entity.durationMs,
  summary: (entity.summary && typeof entity.summary === "object"
    ? entity.summary
    : null) as Record<string, unknown> | null,
  errorMessage: entity.errorMessage,
  errorStack: entity.errorStack,
  logTail: entity.logTail,
  createdAt: entity.createdAt.toISOString(),
})
