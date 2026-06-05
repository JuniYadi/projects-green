import type { PrismaClient } from "@prisma/client"

import type { VpnBillingService } from "./vpn-billing.service"
import { resolveVpnMonthlyPrice } from "./vpn-pricing"

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
   *   - includedSubscription.package.code is "VPN"
   *   - subscriptions.plan is included to resolve plan.code for pricing
   *
   * Each renewal:
   *   1. Resolves the monthly price from the static catalog.
   *   2. Calls `billing.chargeMonthly` (debits balance, writes invoice line).
   *   3. If success: extends currentPeriodStart/currentPeriodEnd by 1 month.
   *   4. If INSUFFICIENT_BALANCE: sets status to SUSPENDED.
   */
  async renewDueSubscriptions(): Promise<VpnRenewalResult> {
    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        currentPeriodEnd: { lte: new Date() },
        package: { code: "VPN" },
      },
      include: { plan: true },
    })

    let renewed = 0
    let suspended = 0
    let errors = 0

    for (const subscription of dueSubscriptions) {
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

        // Idempotency: if the charge was already processed (e.g., a
        // concurrent worker already handled this subscription), skip
        // the period extension so we do not advance an extra month.
        if (!chargeResult.alreadyProcessed) {
          await this.extendPeriod(subscription.id)
          renewed++
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "INSUFFICIENT_BALANCE"
        ) {
          try {
            await this.prisma.subscription.update({
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

    return { renewed, suspended, errors }
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async extendPeriod(subscriptionId: string): Promise<void> {
    const now = new Date()
    const periodStart = now
    const periodEnd = new Date(now)
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    })
  }

  private currentPeriod(now: Date = new Date()): string {
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
  }
}

// Re-export for scripts/vpn-renewal-worker.ts
export type { VpnBillingService }
