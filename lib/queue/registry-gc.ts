import { BaseJob } from "@/lib/queue/base-job"
import { logger } from "@/lib/logger"

export class RegistryGcJob extends BaseJob {
  static readonly queue = "registry-gc"
  static readonly workerConcurrency = 1
  static readonly attempts = 2
  static readonly backoff = { type: "exponential" as const, delay: 10_000 }

  static async dispatch(): Promise<void> {
    await this.enqueue({}, { jobId: "registry-gc-singleton" })
  }

  static async handle(_job: unknown): Promise<void> {
    const { runRegistryGc } =
      await import("@/modules/deploy/workers/registry-gc.worker")
    const result = await runRegistryGc()
    logger.info(result, "[registry-gc] job completed")
  }
}
