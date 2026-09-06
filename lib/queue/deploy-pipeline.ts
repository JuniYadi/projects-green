import { BaseJob } from "@/lib/queue/base-job"
import { logger } from "@/lib/logger"

export type DeployPipelineJobData = {
  deploymentId: string
}

export class DeployPipelineJob extends BaseJob {
  static readonly queue = "deploy-pipeline"
  static readonly workerConcurrency = 2
  static readonly attempts = 3
  static readonly backoff = { type: "exponential" as const, delay: 5_000 }

  static async dispatch(deploymentId: string): Promise<void> {
    await this.enqueue<DeployPipelineJobData>(
      { deploymentId },
      { jobId: `deploy-pipeline_${deploymentId}` }
    )
  }

  static async handle(job: { data: DeployPipelineJobData }): Promise<unknown> {
    const { processQueuedDeployment } =
      await import("@/modules/deploy/deploy-builder.service")
    return processQueuedDeployment(job.data.deploymentId)
  }
}

export async function enqueueDeployment(
  deploymentId: string
): Promise<boolean> {
  try {
    await DeployPipelineJob.dispatch(deploymentId)
    return true
  } catch (error) {
    logger.error(
      {
        err: error,
        deploymentId,
        event: "deploy.enqueue_failed",
      },
      `[deploy-pipeline] failed to enqueue deployment ${deploymentId}`
    )
    return false
  }
}
