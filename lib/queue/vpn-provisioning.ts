import type { Job, JobsOptions } from "bullmq"

import { BaseJob } from "@/lib/queue/base-job"
import { vpnProvisioningService } from "@/modules/vpn/provisioning/vpn-provisioning.service"

export type VpnProvisioningJobData = {
  serverAccountId: string
}

/** Retry schedule from Story 14: 1min, 5min, 15min, 1hr. */
const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000]

/**
 * BullMQ job that provisions one VpnServerAccount. One job per server account
 * means a single failure does not block sibling accounts. Exhausted retries
 * leave the job in the failed set (dead letter) for manual admin retry, and
 * the account row is marked FAILED by the provisioning service.
 */
export class VpnProvisioningJob extends BaseJob {
  static readonly queue = "vpn-provisioning"
  static readonly workerConcurrency = 4
  static readonly attempts = RETRY_DELAYS_MS.length + 1
  static readonly backoff: JobsOptions["backoff"] = { type: "vpn-staged" }
  // Keep failed jobs so admins can inspect and manually retry (dead letter).
  static readonly removeOnFail = { count: 5_000 }

  static async dispatch(serverAccountId: string): Promise<void> {
    await this.enqueue(
      { serverAccountId },
      { jobId: `vpn-provision-${serverAccountId}` }
    )
  }

  static async handle(job: Job<VpnProvisioningJobData>): Promise<void> {
    const { serverAccountId } = job.data
    console.info(
      `[vpn-provisioning] handle job=${job.id ?? "unknown"} account=${serverAccountId} started`
    )
    await job.log(`Provisioning account ${serverAccountId} started`)

    try {
      await vpnProvisioningService.provisionAccount(serverAccountId)
      await job.log(`Provisioning account ${serverAccountId} completed`)
      console.info(
        `[vpn-provisioning] handle job=${job.id ?? "unknown"} account=${serverAccountId} completed`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await job.log(`Provisioning account ${serverAccountId} failed: ${message}`)
      console.error(
        `[vpn-provisioning] handle job=${job.id ?? "unknown"} account=${serverAccountId} failed: ${message}`
      )
      throw error
    }
  }
}

/**
 * Custom backoff strategy implementing the staged retry schedule. Register
 * this on the Worker via `settings.backoffStrategy` in the worker entrypoint.
 */
export function vpnStagedBackoff(attemptsMade: number): number {
  const index = Math.min(attemptsMade - 1, RETRY_DELAYS_MS.length - 1)
  return RETRY_DELAYS_MS[Math.max(index, 0)]
}
