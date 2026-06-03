/**
 * Billing Cycle Service — Monthly billing orchestrator
 *
 * processMonthlyBilling() is the main entry point called from the cron worker:
 * 1. Determines the current billing period (previous month)
 * 2. Finds all active subscriptions
 * 3. For each subscription: aggregates rated usage, creates invoice + lines,
 *    deducts balance, handles insufficient balance
 * 4. Creates a BillingRun tracking the operation
 * 5. Handles idempotency via BillingRun dedup
 */

import { PrismaClient, Prisma } from "@prisma/client"
import Decimal = Prisma.Decimal

import { UsageLedgerService } from "./usage-ledger.service"
import {
  type BillingRunResult,
  type SubscriptionBillingResult,
  GRACE_PERIOD_DAYS,
} from "./billing-cycle.types"



const IDR_CURRENCY = "IDR"
const ZERO = new Decimal(0)

export class BillingCycleService {
  constructor(
    private prisma: PrismaClient,
    private usageLedger: UsageLedgerService,
  ) {}

  /**
   * Main entry point. Processes monthly billing for all active subscriptions.
   * Returns details of what was processed, any skipped subscriptions, and
   * any errors encountered.
   */
  async processMonthlyBilling(): Promise<BillingRunResult> {
    const now = new Date()
    const period = this.getPeriodString(now)

    // ── Idempotency check: skip if a run for this period already exists ───
    const periodStart = this.getPeriodStart(now)
    const periodEnd = this.getPeriodEnd(now)

    const existingRun = await this.prisma.billingRun.findFirst({
      where: {
        runType: "INVOICING",
        periodStart,
        periodEnd,
        status: "SUCCEEDED",
      },
    })

    if (existingRun) {
      console.info(
        `[BillingCycle] BillingRun ${existingRun.id} already exists for period ${period}. Skipping.`,
      )
      return {
        billingRunId: existingRun.id,
        processed: 0,
        skipped: 0,
        invoices: [],
      }
    }

    // ── Find active subscriptions ─────────────────────────────────────────
    const subscriptions = await this.prisma.billingSubscription.findMany({
      where: { status: "ACTIVE" },
      include: {
        billingAccount: true,
      },
    })

    if (subscriptions.length === 0) {
      console.info("[BillingCycle] No active subscriptions found.")
      return {
        billingRunId: "",
        processed: 0,
        skipped: 0,
        invoices: [],
      }
    }

    // ── Create BillingRun ─────────────────────────────────────────────────
    const billingRun = await this.prisma.billingRun.create({
      data: {
        runType: "INVOICING",
        periodStart,
        periodEnd,
        status: "RUNNING",
        metadataJson: {
          period,
          subscriptionCount: subscriptions.length,
        },
      },
    })

    const results: SubscriptionBillingResult[] = []

    for (const subscription of subscriptions) {
      try {
        const result = await this.processSubscription(
          subscription,
          period,
          billingRun.id,
        )
        results.push(result)
      } catch (error) {
        console.error(
          `[BillingCycle] Error processing subscription ${subscription.id}:`,
          error,
        )
        results.push({
          subscriptionId: subscription.id,
          status: "SKIPPED",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    // ── Finalize BillingRun ────────────────────────────────────────────────
    const processed = results.filter((r) => r.status === "BILLED").length
    const skipped = results.filter((r) => r.status === "SKIPPED").length

    await this.prisma.billingRun.update({
      where: { id: billingRun.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        metadataJson: {
          period,
          subscriptionCount: subscriptions.length,
          processed,
          skipped,
          results: results.map((r) => ({
            subscriptionId: r.subscriptionId,
            status: r.status,
            invoiceId: r.invoiceId,
            totalAmount: r.totalAmount,
            error: r.error,
          })),
        },
      },
    })

    console.info(
      `[BillingCycle] Completed: ${processed} processed, ${skipped} skipped.`,
    )

    return {
      billingRunId: billingRun.id,
      processed,
      skipped,
      invoices: results
        .filter((r) => r.invoiceId)
        .map((r) => ({
          invoiceId: r.invoiceId!,
          subscriptionId: r.subscriptionId,
          totalAmount: r.totalAmount ?? 0,
          status:
            r.status === "INSUFFICIENT_BALANCE" ? "DRAFT" as const : "PAID" as const,
        })),
    }
  }

  /**
   * Process a single subscription for the given billing period.
   */
  private async processSubscription(
    subscription: {
      id: string
      billingAccountId: string
      billingAccount: { organizationId: string | null; balance: Decimal; id: string }
    },
    period: string,
    billingRunId: string,
  ): Promise<SubscriptionBillingResult> {
    const organizationId = subscription.billingAccount.organizationId

    if (!organizationId) {
      console.info(
        `[BillingCycle] Subscription ${subscription.id}: no organizationId, skipping.`,
      )
      return { subscriptionId: subscription.id, status: "SKIPPED" }
    }

    // ── Generate rated usage ──────────────────────────────────────────────
    const ratedUsage = await this.usageLedger.generateRatedUsage(
      organizationId,
      period,
    )

    // ── Skip if no usage (configurable: could create $0 invoice) ──────────
    const totalAmount = ratedUsage.reduce(
      (sum, u) => sum.plus(u.cappedAmountIdr),
      ZERO,
    )

    if (totalAmount.isZero()) {
      console.info(
        `[BillingCycle] Subscription ${subscription.id}: zero usage, skipping.`,
      )
      return {
        subscriptionId: subscription.id,
        status: "SKIPPED",
      }
    }

    // ── Check for existing OPEN invoices (previous unpaid) ────────────────
    const existingOpenInvoices = await this.prisma.invoice.findMany({
      where: {
        billingAccountId: subscription.billingAccountId,
        status: "OPEN",
      },
    })

    // ── Create invoice + lines in a transaction ───────────────────────────
    const result = await this.prisma.$transaction(async (tx) => {
      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          billingAccountId: subscription.billingAccountId,
          subscriptionId: subscription.id,
          billingRunId,
          invoiceNumber: `INV-${period}-${subscription.id.slice(0, 8)}-${billingRunId.slice(0, 8)}`,
          periodStart: this.getPeriodStart(new Date()),
          periodEnd: this.getPeriodEnd(new Date()),
          currency: IDR_CURRENCY,
          status: "DRAFT",
          subtotalAmount: totalAmount,
          totalAmount,
          dueAt: new Date(Date.now() + GRACE_PERIOD_DAYS * 86400000),
        },
      })

      // Create invoice lines from rated usage
      for (const usage of ratedUsage) {
        await tx.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            lineType: "METERED" as const,
            description: usage.category ?? "Usage",
            quantity: new Decimal(usage.meterValue),
            unitPrice: new Decimal(usage.cappedAmountIdr.toString()),
            amount: usage.cappedAmountIdr,
            currency: IDR_CURRENCY,
          },
        })
      }

      // Include previous unpaid invoices' amounts
      const previousUnpaidTotal = existingOpenInvoices.reduce(
        (sum, inv) => sum.plus(inv.totalAmount),
        ZERO,
      )

      const totalDue = totalAmount.plus(previousUnpaidTotal)

      // Try to deduct from balance
      const account = await tx.billingAccount.findUnique({
        where: { id: subscription.billingAccountId },
      })

      if (!account) {
        throw new Error("BillingAccount not found.")
      }

      if (account.balance.gte(totalDue)) {
        // Sufficient balance — deduct and mark PAID directly
        await tx.billingAccount.update({
          where: { id: account.id },
          data: { balance: account.balance.minus(totalDue) },
        })

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: "PAID", paidAt: new Date(), issuedAt: new Date() },
        })

        // Also mark previous unpaid invoices as PAID
        if (existingOpenInvoices.length > 0) {
          await tx.invoice.updateMany({
            where: {
              id: { in: existingOpenInvoices.map((inv) => inv.id) },
            },
            data: { status: "PAID", paidAt: new Date() },
          })
        }

        // Create adjustment for the deduction
        await tx.billingAdjustment.create({
          data: {
            billingAccountId: account.id,
            invoiceId: invoice.id,
            adjustmentType: "DEBIT",
            amount: totalDue,
            currency: IDR_CURRENCY,
            reason: `Monthly billing charge for period ${period}`,
            metadataJson: {
              billingRunId,
              subscriptionId: subscription.id,
              period,
            },
          },
        })

        return {
          invoiceId: invoice.id,
          totalAmount: Number(totalDue.toString()),
          status: "PAID" as const,
        }
      }

      // Insufficient balance — keep as DRAFT for admin review
      return {
        invoiceId: invoice.id,
        totalAmount: Number(totalDue.toString()),
        status: "OPEN" as const,
      }
    })

    return {
      subscriptionId: subscription.id,
      status:
        result.status === "PAID"
          ? "BILLED"
          : "INSUFFICIENT_BALANCE",
      invoiceId: result.invoiceId,
      totalAmount: result.totalAmount,
    }
  }

  // ─── Period helpers ─────────────────────────────────────────────────────

  /**
   * Get the period string for a date (e.g. "2026-04").
   */
  private getPeriodString(date: Date): string {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
  }

  /**
   * Get start of the previous month (the period being billed).
   */
  private getPeriodStart(date: Date): Date {
    const d = new Date(date)
    d.setUTCDate(1)
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCMonth(d.getUTCMonth() - 1) // previous month
    return d
  }

  /**
   * Get end of the previous month (the period being billed).
   */
  private getPeriodEnd(date: Date): Date {
    const d = this.getPeriodStart(date)
    d.setUTCMonth(d.getUTCMonth() + 1)
    d.setUTCMilliseconds(-1)
    return d
  }
}
