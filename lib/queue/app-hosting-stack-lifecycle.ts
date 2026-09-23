import { BaseJob } from "@/lib/queue/base-job"
import { logger } from "@/lib/logger"

export type AppHostingStackLifecycleAction = "suspend" | "resume"

export type AppHostingStackLifecycleJobData = {
  stackId: string
  action: AppHostingStackLifecycleAction
}

export class AppHostingStackLifecycleJob extends BaseJob {
  static readonly queue = "app-hosting-stack-lifecycle"
  static readonly workerConcurrency = 2
  static readonly attempts = 3
  static readonly backoff = { type: "exponential" as const, delay: 5_000 }

  static async dispatch(data: AppHostingStackLifecycleJobData): Promise<void> {
    await this.enqueue<AppHostingStackLifecycleJobData>(data, {
      jobId: `app-hosting-stack-lifecycle_${data.action}_${data.stackId}`,
    })
  }

  static handler: (data: AppHostingStackLifecycleJobData) => Promise<unknown> =
    async (data) => {
      const { processStackLifecycleJob } =
        await import("@/modules/deploy/admin-stacks.service")
      return processStackLifecycleJob(data)
    }

  static async handle(job: {
    data: AppHostingStackLifecycleJobData
  }): Promise<void> {
    await this.handler(job.data)
  }
}

export async function enqueueStackLifecycle(
  data: AppHostingStackLifecycleJobData
): Promise<boolean> {
  try {
    await AppHostingStackLifecycleJob.dispatch(data)
    return true
  } catch (error) {
    logger.error(
      {
        err: error,
        stackId: data.stackId,
        action: data.action,
        event: "app_hosting.stack_lifecycle.enqueue_failed",
      },
      `[app-hosting-stack-lifecycle] failed to enqueue ${data.action} for stack ${data.stackId}`
    )
    return false
  }
}
