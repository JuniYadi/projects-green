import { Prisma, type PrismaClient } from "@prisma/client"

import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { vpnProvisioningService } from "@/modules/vpn/provisioning/vpn-provisioning.service"

// ─── Constants ──────────────────────────────────────────────────────────

const BATCH_SIZE = 100

/** Days after first renewal failure before the subscription is suspended. */
export const SUSPEND_AFTER_DAYS = 3
/** Days after first renewal failure before the subscription is expired. */
export const EXPIRE_AFTER_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

// ─── Types ──────────────────────────────────────────────────────────────

export type VpnRenewalResult = {
  renewed: number
  suspended: number
  expired: number
  retried: number
  errors: number
}

type PrismaLike = Pick<
  PrismaClient,
  "vpnSubscription" | "vpnMobileDevice" | "vpnPairingToken"
>

type RenewalSubscription = {
  id: string
  organizationId: string
  packageId: string
  priceLocked: Prisma.Decimal
  currency: string
  renewalFailedAt: Date | null
  serverAccounts?: Array<{ id: string }>
}

// ─── Service ────────────────────────────────────────────────────────────

/**
 * VPN monthly renewal service (Story 16).
 *
 * Scans ACTIVE/SUSPENDED VpnSubscriptions whose current period has ended and
 * charges the next month upfront at the subscription's *locked* price
 * (grandfathering — package price changes never affect existing subs).
 *
 * Grace ladder on INSUFFICIENT_BALANCE (driven by `renewalFailedAt`):
 *   - Day 0-2: keep current status, retry next run (top-up may arrive).
 *   - Day 3-6: SUSPENDED.
 *   - Day 7+:  EXPIRED.
 *
 * Safety:
 *   - Batch-limited with cursor pagination (no unbounded scan).
 *   - Period extension uses `updateMany` with a `currentPeriodEnd <= now`
 *     guard so concurrent workers cannot double-extend.
 *   - Idempotency via `vpn-package:<subscriptionId>:<period>` (handled by
 *     BillingTransactionService) — duplicate retries never double-charge.
 */
export class VpnRenewalService {
  private readonly prisma: PrismaLike
  private readonly transactions: BillingTransactionService

  constructor(prisma: PrismaLike, transactions: BillingTransactionService) {
    this.prisma = prisma
    this.transactions = transactions
  }

  async renewDueSubscriptions(
    now: Date = new Date()
  ): Promise<VpnRenewalResult> {
    const result: VpnRenewalResult = {
      renewed: 0,
      suspended: 0,
      expired: 0,
      retried: 0,
      errors: 0,
    }
    let cursor: string | undefined

    while (true) {
      const batch = await this.prisma.vpnSubscription.findMany({
        where: {
          status: { in: ["ACTIVE", "SUSPENDED"] },
          currentPeriodEnd: { lte: now },
        },
        take: BATCH_SIZE,
        orderBy: { id: "asc" },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: { serverAccounts: { select: { id: true } } },
      })

      if (batch.length === 0) break

      for (const subscription of batch) {
        await this.renewOne(subscription, now, result)
      }

      cursor = batch[batch.length - 1].id
    }

    // T7.4 — Daily cleanup: remove expired pairing tokens older than 7 days.
    try {
      const staleTokens = new Date(now.getTime() - 7 * DAY_MS)
      await this.prisma.vpnPairingToken.deleteMany({
        where: { expiresAt: { lt: staleTokens } },
      })
    } catch {
      // Best-effort cleanup.
    }

    // T7.5 — Daily cleanup: remove REVOKED devices older than 30 days.
    try {
      const oldRevoked = new Date(now.getTime() - 30 * DAY_MS)
      await this.prisma.vpnMobileDevice.deleteMany({
        where: {
          status: "REVOKED",
          revokedAt: { lt: oldRevoked },
        },
      })
    } catch {
      // Best-effort cleanup.
    }

    return result
  }

  // ─── Private ────────────────────────────────────────────────────────

  private async renewOne(
    subscription: RenewalSubscription,
    now: Date,
    result: VpnRenewalResult
  ): Promise<void> {
    const period = this.currentPeriod(now)
    try {
      const charge = await this.transactions.debitServiceBalance({
        organizationId: subscription.organizationId,
        amount: subscription.priceLocked,
        currency: subscription.currency,
        source: "VPN",
        reason: "VPN package monthly renewal",
        idempotencyKey: `vpn-package:${subscription.id}:${period}`,
        metadata: {
          vpnSubscriptionId: subscription.id,
          packageId: subscription.packageId,
          period,
        },
        line: {
          description: "VPN package monthly renewal",
          quantity: new Prisma.Decimal(1),
          unitPrice: subscription.priceLocked,
          lineType: "SUBSCRIPTION",
        },
      })

      if (!charge.alreadyProcessed) {
        try {
          const extended = await this.extendPeriod(subscription.id, now)
          if (extended) result.renewed++
        } catch {
          result.errors++
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
        await this.applyGrace(subscription, now, result)
      } else {
        result.errors++
      }
    }
  }

  /**
   * Advance the grace ladder for a subscription whose renewal charge failed.
   * Day 0-2 → retry, Day 3-6 → suspend, Day 7+ → expire.
   */
  private async applyGrace(
    subscription: { id: string; renewalFailedAt: Date | null },
    now: Date,
    result: VpnRenewalResult
  ): Promise<void> {
    const failedAt = subscription.renewalFailedAt ?? now
    const daysFailed = Math.floor((now.getTime() - failedAt.getTime()) / DAY_MS)

    try {
      if (daysFailed >= EXPIRE_AFTER_DAYS) {
        await this.prisma.vpnSubscription.update({
          where: { id: subscription.id },
          data: { status: "EXPIRED" },
        })
        // Product terminated: permanently remove remote OpenVPN certs/configs.
        await Promise.allSettled(
          (subscription.serverAccounts ?? []).map((account) =>
            vpnProvisioningService.removeRemoteAccount(account.id)
          )
        )

        // T7.2 — Revoke all mobile devices on subscription expiry.
        await this.prisma.vpnMobileDevice
          .updateMany({
            where: {
              subscriptionId: subscription.id,
              status: { in: ["ACTIVE", "SUSPENDED"] },
            },
            data: {
              status: "REVOKED",
              revokedAt: now,
              revokedReason: "subscription expired",
            },
          })
          .catch(() => {
            // Device revocation is best-effort.
          })
        result.expired++
      } else if (daysFailed >= SUSPEND_AFTER_DAYS) {
        await this.prisma.vpnSubscription.update({
          where: { id: subscription.id },
          data: {
            status: "SUSPENDED",
            renewalFailedAt: subscription.renewalFailedAt ?? now,
          },
        })
        // T7.1 — Suspend all ACTIVE mobile devices on subscription suspend.
        await this.prisma.vpnMobileDevice
          .updateMany({
            where: {
              subscriptionId: subscription.id,
              status: "ACTIVE",
            },
            data: {
              status: "SUSPENDED",
              revokedReason: "payment failed",
            },
          })
          .catch(() => {
            // Device suspension is best-effort.
          })
        result.suspended++
      } else {
        // Still within the retry window — only record the first failure.
        await this.prisma.vpnSubscription.update({
          where: { id: subscription.id },
          data: { renewalFailedAt: subscription.renewalFailedAt ?? now },
        })
        result.retried++
      }
    } catch {
      result.errors++
    }
  }

  /**
   * Extend the period to the end of the next calendar month and clear
   * renewal-failure tracking. Aligns to calendar months so renewal always
   * happens at the start of a month, matching the pro-rated first-period
   * from the purchase flow. Idempotent under concurrent workers via the
   * `currentPeriodEnd` guard.
   */
  private async extendPeriod(id: string, now: Date): Promise<boolean> {
    // End of next calendar month (month+2, day 0).
    // Example: now=July 1 → month+2=September, day 0=August 31
    const periodEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59, 999)
    )

    const updated = await this.prisma.vpnSubscription.updateMany({
      where: { id, currentPeriodEnd: { lte: now } },
      data: {
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        renewalFailedAt: null,
      },
    })

    // T7.3 — Reactivate SUSPENDED mobile devices on successful renewal.
    if (updated.count > 0) {
      await this.prisma.vpnMobileDevice
        .updateMany({
          where: {
            subscriptionId: id,
            status: "SUSPENDED",
          },
          data: {
            status: "ACTIVE",
            revokedReason: null,
          },
        })
        .catch(() => {
          // Device reactivation is best-effort.
        })
    }

    return updated.count > 0
  }

  private currentPeriod(now: Date): string {
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
  }
}
