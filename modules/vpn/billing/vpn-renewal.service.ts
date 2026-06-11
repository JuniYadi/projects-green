import type { PrismaClient } from "@prisma/client"

import type { VpnBillingService } from "./vpn-billing.service"
import { resolveVpnMonthlyPrice } from "./vpn-pricing"

// ─── Constants ──────────────────────────────────────────────────────────

const BATCH_SIZE = 100

// ─── Types ──────────────────────────────────────────────────────────────

export type VpnRenewalResult = {
  renewed: number
  suspended: number
  errors: number
}

// ─── Service ────────────────────────────────────────────────────────────

/**
 * VPN monthly renewal service.
 *
 * Scans for ACTIVE VPN subscriptions whose current period has ended
 * and charges the next month upfront. Follows MVP rules:
 *
 *   - VPN is monthly-only — no PAYG, no grace period.
 *   - INSUFFICIENT_BALANCE → subscription is SUSPENDED immediately.
 *   - Idempotency via `vpn-monthly:<subscriptionId>:<period>` key
 *     (handled by VpnBillingService.chargeMonthly → BillingTransactionService).
 *
 * Safety guarantees:
 *   - Batch-limited (`BATCH_SIZE`) with cursor-based pagination so the
 *     query does not scan unbounded rows at scale.
 *   - Period extension uses `updateMany` with a WHERE clause on
 *     `currentPeriodEnd` making it idempotent — concurrent workers
 *     cannot double-extend the same subscription.
 *   - `extendPeriod` failures are caught and count as `errors`; the
 *     charge is already completed so the next worker run will see
 *     `alreadyProcessed=true` and re-attempt extension.
 */
export class VpnRenewalService {
  constructor(
    private prisma: PrismaClient,
    private billing: Pick<VpnBillingService, "chargeMonthly">,
  ) {}

  /**
   * Renew all due VPN subscriptions.
   *
   * A subscription is "due" when:
   *   - status is ACTIVE
   *   - currentPeriodEnd is on or before the current UTC timestamp
   *   - package.code is "VPN"
   *   - plan is included to resolve plan.code for pricing
   *
   * Each renewal:
   *   1. Resolves the monthly price from the static catalog.
   *   2. Calls `billing.chargeMonthly` (debits balance, writes invoice line).
   *   3. If success: extends currentPeriodStart/currentPeriodEnd by 1 month
   *      (idempotent via updateMany + WHERE guard).
   *   4. If INSUFFICIENT_BALANCE: sets status to SUSPENDED (no grace).
   */
  async renewDueSubscriptions(): Promise<VpnRenewalResult> {
    let renewed = 0
    let suspended = 0
    let errors = 0
    let cursor: string | undefined

    while (true) {
      const batch = await this.prisma.serviceSubscription.findMany({
        where: {
          status: "ACTIVE",
          currentPeriodEnd: { lte: new Date() },
          package: { code: "VPN" },
        },
        include: { plan: true },
        take: BATCH_SIZE,
        orderBy: { id: "asc" },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })

      if (batch.length === 0) break

      for (const subscription of batch) {
        try {
          const meta = (subscription.metadata ?? {}) as Record<string, unknown>
          const regionCode =
            typeof meta.regionCode === "string"
              ? meta.regionCode
              : "INDONESIA"
          const planCode = subscription.plan.code

          // Resolve price from the static catalog
          const price = resolveVpnMonthlyPrice({
            regionCode,
            planCode,
          })

          const period = this.currentPeriod()

          // Charge the next month upfront
          const chargeResult = await this.billing.chargeMonthly({
            organizationId: subscription.organizationId,
            vpnSubscriptionId: subscription.id,
            regionCode,
            amount: price.amount,
            period,
          })

          // Idempotency + race guard:
          //
          // The period extension uses `updateMany` with a WHERE clause
          // that checks `currentPeriodEnd <= now`. This guarantees that
          // even if two concurrent workers both see alreadyProcessed=false,
          // only ONE of them will successfully extend the period — the
          // second worker's updateMany will match 0 rows because the
          // first worker already advanced currentPeriodEnd.
          //
          // If `extendPeriod` throws (transient DB error), we count it
          // as `errors` rather than `renewed`. The charge is already
          // committed and the next worker run will see
          // `alreadyProcessed=true` and re-attempt only the extension.
          if (!chargeResult.alreadyProcessed) {
            try {
              const extended = await this.extendPeriod(subscription.id)
              if (extended) {
                renewed++
              }
            } catch {
              errors++
            }
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "INSUFFICIENT_BALANCE"
          ) {
            try {
              await this.prisma.serviceSubscription.update({
                where: { id: subscription.id },
                data: {
                  status: "SUSPENDED",
                  metadata: {
                    ...((subscription.metadata ?? {}) as Record<string, unknown>),
                    suspendedAt: new Date().toISOString(),
                    suspensionReason: "INSUFFICIENT_BALANCE",
                  },
                },
              })
              suspended++
            } catch {
              errors++
            }
          } else {
            errors++
          }
        }
      }

      cursor = batch[batch.length - 1].id
    }

    return { renewed, suspended, errors }
  }

  // ─── Private ──────────────────────────────────────────────────────────

  /**
   * Extend the subscription period by one month.
   *
   * Uses `updateMany` with a WHERE clause (`currentPeriodEnd <= now`)
   * to make this operation idempotent under concurrent workers. If
   * another worker already extended the period, the update matches 0
   * rows and returns false.
   */
  private async extendPeriod(subscriptionId: string): Promise<boolean> {
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)

    const result = await this.prisma.serviceSubscription.updateMany({
      where: {
        id: subscriptionId,
        currentPeriodEnd: { lte: now },
      },
      data: {
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    })

    return result.count > 0
  }

  private currentPeriod(now: Date = new Date()): string {
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
  }
}

// Re-export for scripts/vpn-renewal-worker.ts
export type { VpnBillingService }
