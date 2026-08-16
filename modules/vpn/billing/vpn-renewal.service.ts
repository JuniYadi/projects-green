import { Prisma, type PrismaClient } from "@prisma/client"

import { BillingOrderService } from "@/modules/billing/orders/order.service"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import { vpnEmailService } from "@/modules/vpn/email.service"
import type { VpnEmailService } from "@/modules/vpn/email.service"

// ─── Constants ──────────────────────────────────────────────────────────

const BATCH_SIZE = 100

const DAY_MS = 24 * 60 * 60 * 1000

// ─── Types ──────────────────────────────────────────────────────────────

export type VpnRenewalResult = {
  renewed: number
  retried: number
  errors: number
}

type PrismaLike = Pick<
  PrismaClient,
  | "vpnSubscription"
  | "serviceSubscription"
  | "vpnMobileDevice"
  | "vpnPairingToken"
>

type RenewalSubscription = {
  id: string
  organizationId: string
  packageId: string
  serviceSubscriptionId?: string | null
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
 * On INSUFFICIENT_BALANCE it records `renewalFailedAt` as a diagnostic and
 * retries next run. It decides no rung: suspend and terminate belong to
 * `RenewalCoordinatorService`, which counts from
 * `ServiceSubscription.currentPeriodEnd` per the PRD ladder.
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
  private readonly orders: BillingOrderService
  private readonly emailService: VpnEmailService

  constructor(
    prisma: PrismaLike,
    _transactions: BillingTransactionService,
    emailService?: VpnEmailService,
    orders?: BillingOrderService
  ) {
    this.prisma = prisma
    this.transactions = _transactions
    this.orders = orders ?? new BillingOrderService(prisma as PrismaClient)
    this.emailService = emailService ?? vpnEmailService
  }

  async renewDueSubscriptions(
    now: Date = new Date()
  ): Promise<VpnRenewalResult> {
    const result: VpnRenewalResult = {
      renewed: 0,
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
      if (!subscription.serviceSubscriptionId) {
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
          const extended = await this.extendPeriod(subscription.id, now)
          if (extended) result.renewed++
        }
      } else {
        await this.orders.renewServiceSubscription(
          subscription.serviceSubscriptionId,
          now
        )
        result.renewed++
        this.emailService
          .sendRenewalSuccess(subscription.organizationId, undefined, period)
          .catch(() => {})
      }
    } catch (error) {
      if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
        // Record the first failure as a diagnostic only. Suspend/terminate
        // is RenewalCoordinatorService's decision, counted from the PRD
        // ladder against ServiceSubscription.currentPeriodEnd.
        await this.prisma.vpnSubscription.update({
          where: { id: subscription.id },
          data: { renewalFailedAt: subscription.renewalFailedAt ?? now },
        })
        result.retried++
        this.emailService
          .sendRenewalFailed(subscription.organizationId)
          .catch(() => {})
      } else {
        result.errors++
      }
    }
  }

  private async extendPeriod(id: string, now: Date): Promise<boolean> {
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
    if (updated.count > 0) {
      await this.prisma.vpnMobileDevice
        .updateMany({
          where: { subscriptionId: id, status: "SUSPENDED" },
          data: { status: "ACTIVE", revokedReason: null },
        })
        .catch(() => {})
    }
    return updated.count > 0
  }
  private currentPeriod(now: Date): string {
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
  }
}
