import type { Job } from "bullmq"

import { BaseJob } from "@/lib/queue/base-job"
import { vpnServerSyncService } from "@/modules/vpn/provisioning/vpn-server-sync.service"

export type VpnServerSyncJobData = {
  serverId: string
  correlationId?: string | null
}

/**
 * BullMQ job that scans all ACTIVE subscriptions linked to a VPN server and
 * creates missing VpnServerAccount rows for any newly-enabled protocols.
 * Deduplicated by serverId so re-clicking "Sync Protocols" replaces the
 * pending job rather than stacking.
 */
export class VpnServerSyncJob extends BaseJob {
  static readonly queue = "vpn-server-sync"
  static readonly workerConcurrency = 1
  static readonly attempts = 3

  static async dispatch(serverId: string, correlationId?: string): Promise<void> {
    await this.enqueue(
      { serverId, correlationId: correlationId ?? null },
      { jobId: `vpn-sync-${serverId}` }
    )
  }

  static async handle(job: Job<VpnServerSyncJobData>): Promise<void> {
    const { serverId, correlationId } = job.data
    console.info(
      `[vpn-server-sync] handle job=${job.id ?? "unknown"} server=${serverId} started`
    )
    await job.log(`Sync protocols for server ${serverId} started`)

    try {
      await vpnServerSyncService.sync(serverId, correlationId ?? job.id ?? "unknown")
      await job.log(`Sync protocols for server ${serverId} completed`)
      console.info(
        `[vpn-server-sync] handle job=${job.id ?? "unknown"} server=${serverId} completed`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await job.log(`Sync protocols for server ${serverId} failed: ${message}`)
      console.error(
        `[vpn-server-sync] handle job=${job.id ?? "unknown"} server=${serverId} failed: ${message}`
      )
      throw error
    }
  }
}
