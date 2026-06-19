import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"

// ─── Types ──────────────────────────────────────────────────────────────

export type ChargeMonthlyInput = {
  organizationId: string
  vpnSubscriptionId: string
  regionCode: string
  amount: Prisma.Decimal
  period: string
}

// ─── Service ────────────────────────────────────────────────────────────

/**
 * VPN monthly billing service.
 *
 * MVP rules:
 * - VPN is monthly basis only — no PAYG, no grace period.
 * - VPN never mutates BillingAccount.balance directly.
 * - All charges flow through BillingTransactionService.debitServiceBalance
 *   which atomically checks balance, debits, and appends a SUBSCRIPTION
 *   line to the current-month service invoice.
 * - Idempotency key is `vpn-monthly:<subscriptionId>:<period>` so a
 *   duplicate provision or worker retry within the same period does not
 *   double-charge the customer.
 * - The caller is responsible for resolving `amount` from the plan/region
 *   catalog and `period` from the current billing window. This service
 *   does not own pricing.
 */
export class VpnBillingService {
  constructor(
    private prisma: PrismaClient,
    private transactions: BillingTransactionService
  ) {}

  /**
   * Charge the monthly VPN fee upfront through the billing foundation.
   *
   * Throws:
   * - `BILLING_ACCOUNT_NOT_FOUND` when the organization has no billing
   *   account.
   * - `INSUFFICIENT_BALANCE` (propagated from the transaction service)
   *   when the customer's balance cannot cover the monthly amount.
   */
  async chargeMonthly(input: ChargeMonthlyInput) {
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")

    return this.transactions.debitServiceBalance({
      organizationId: input.organizationId,
      amount: input.amount,
      currency: account.currency,
      source: "VPN",
      reason: "VPN monthly payment",
      idempotencyKey: `vpn-monthly:${input.vpnSubscriptionId}:${input.period}`,
      metadata: {
        vpnSubscriptionId: input.vpnSubscriptionId,
        regionCode: input.regionCode,
        period: input.period,
      },
      line: {
        description: `VPN region ${input.regionCode} — ${input.period}`,
        quantity: new Prisma.Decimal(1),
        unitPrice: input.amount,
        lineType: "SUBSCRIPTION",
      },
    })
  }
}
