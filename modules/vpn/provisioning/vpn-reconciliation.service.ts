/**
 * VPN Reconciliation Service
 *
 * Periodically scans for orphaned PENDING server accounts on ACTIVE subscriptions
 * and automatically re-dispatches provisioning jobs. This handles the case where
 * a BullMQ job is lost (worker crash before processing) leaving accounts stuck
 * in PENDING forever.
 *
 * Idempotent: uses BullMQ jobId deduplication (`vpn-provision-{serverAccountId}`).
 * Multiple reconciliation cycles for the same orphaned account only produce one job.
 */

import { prisma } from "@/lib/prisma"
import { logAuditEvent } from "@/lib/audit.service"
import { VpnProvisioningJob } from "@/lib/queue/vpn-provisioning"

const RECONCILIATION_INTERVAL_MS = 5 * 60 * 1_000 // 5 minutes
const STALE_THRESHOLD_MS = 5 * 60 * 1_000 // 5 minutes
const MAX_ACCOUNTS_PER_CYCLE = 50

export type ReconciliationResult = {
  dispatched: number
  skipped: number
  errors: number
}

export class VpnReconciliationService {
  /**
   * Run one reconciliation cycle: find orphaned PENDING accounts and dispatch jobs.
   *
   * An account is orphaned when:
   * - provisioningStatus = PENDING
   * - updatedAt < now - 5 minutes (recently-created PENDING accounts get time to process)
   * - subscription status = ACTIVE
   */
  async runCycle(): Promise<ReconciliationResult> {
    const enabled = process.env.VPN_RECONCILIATION_ENABLED
    if (enabled === "false") {
      return { dispatched: 0, skipped: 0, errors: 0 }
    }

    const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS)

    const orphanedAccounts = await prisma.vpnServerAccount.findMany({
      where: {
        provisioningStatus: "PENDING",
        updatedAt: { lt: cutoff },
        subscription: { status: "ACTIVE" },
      },
      take: MAX_ACCOUNTS_PER_CYCLE,
      orderBy: { updatedAt: "asc" },
    })

    let dispatched = 0
    let skipped = 0
    let errors = 0

    for (const account of orphanedAccounts) {
      try {
        await VpnProvisioningJob.dispatch(account.id)
        logAuditEvent({
          serverAccountId: account.id,
          action: "PROVISIONING_RETRIED",
          status: "PENDING",
          message: `Reconciliation dispatched retry for orphaned account ${account.id}`,
        }).catch(() => {})
        dispatched++
      } catch {
        errors++
      }
    }

    // Accounts not returned by the query (not ACTIVE subscription, or too recent) are skipped
    skipped = MAX_ACCOUNTS_PER_CYCLE - dispatched - errors

    logAuditEvent({
      action: "RECONCILIATION_RAN",
      status: "OK",
      message: `Reconciliation cycle: ${dispatched} dispatched, ${skipped} skipped, ${errors} errors`,
      details: { dispatched, skipped, errors },
    }).catch(() => {})

    return { dispatched, skipped: Math.max(skipped, 0), errors }
  }

  /** Start the reconciliation loop. Call once at worker startup. */
  start(): ReturnType<typeof setInterval> {
    return setInterval(async () => {
      try {
        const result = await this.runCycle()
        if (result.dispatched > 0 || result.errors > 0) {
          console.info(
            `[vpn-reconciliation] dispatched=${result.dispatched} errors=${result.errors}`
          )
        }
      } catch (error) {
        console.error("[vpn-reconciliation] cycle failed:", error)
      }
    }, RECONCILIATION_INTERVAL_MS)
  }
}

export const vpnReconciliationService = new VpnReconciliationService()
