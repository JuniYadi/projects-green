import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"

// ─── Types ──────────────────────────────────────────────────────────────

export type AppHostingBillingMode = "PAYG" | "PACKAGE"

export type AppHostingChargeQuote = {
  hourlyCost: Prisma.Decimal
  upfrontCost: Prisma.Decimal
  currency: string
  requiredBalance: Prisma.Decimal
  bufferHours: number
}

export type PaygChargeResult = {
  billingAccountId: string
  adjustmentId: string
  balanceBefore: Prisma.Decimal
  balanceAfter: Prisma.Decimal
  amount: Prisma.Decimal
  currency: string
  alreadyProcessed: boolean
  graceEntered?: boolean
}

export type GraceCheckResult = {
  suspended: boolean
}

export type GraceClearResult = {
  cleared: boolean
}

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000 // 24 hours
const MIN_BUFFER_HOURS = 24

// ─── Service ────────────────────────────────────────────────────────────

export class AppHostingBillingService {
  constructor(
    private prisma: PrismaClient,
    private transactions: BillingTransactionService,
  ) {}

  /**
   * Normalize buffer hours — minimum 24, floored to integer.
   */
  normalizeBufferHours(value: number | null | undefined): number {
    if (value == null || isNaN(value)) return MIN_BUFFER_HOURS
    return Math.max(MIN_BUFFER_HOURS, Math.floor(value))
  }

  /**
   * Calculate the required balance for a PAYG deployment.
   */
  async quotePayg(input: {
    organizationId: string
    hourlyCost: Prisma.Decimal
    bufferHours?: number
  }): Promise<AppHostingChargeQuote> {
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")

    const bufferHours = this.normalizeBufferHours(input.bufferHours)
    const requiredBalance = input.hourlyCost.times(bufferHours)

    return {
      hourlyCost: input.hourlyCost,
      upfrontCost: new Prisma.Decimal(0),
      currency: account.currency,
      requiredBalance,
      bufferHours,
    }
  }

  /**
   * Assert that the organization has enough balance to start a PAYG deployment.
   * Throws INSUFFICIENT_PAYG_BUFFER if balance < hourlyCost × bufferHours.
   */
  async assertCanStartPayg(input: {
    organizationId: string
    hourlyCost: Prisma.Decimal
    bufferHours?: number
  }): Promise<AppHostingChargeQuote> {
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")

    const quote = await this.quotePayg(input)

    if (account.balance.lt(quote.requiredBalance)) {
      throw new Error("INSUFFICIENT_PAYG_BUFFER")
    }

    return quote
  }

  /**
   * Charge one hour of PAYG runtime through the billing foundation.
   * On insufficient balance, enters PAYMENT_GRACE instead of throwing.
   */
  async chargePaygRuntimeHour(input: {
    organizationId: string
    stackId: string
    hourlyCost: Prisma.Decimal
    occurredAt: Date
  }): Promise<PaygChargeResult> {
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")

    const hourKey = input.occurredAt.toISOString().slice(0, 13) // e.g. "2026-06-04T10"

    try {
      const result = await this.transactions.debitServiceBalance({
        organizationId: input.organizationId,
        amount: input.hourlyCost,
        currency: account.currency,
        source: "APP_HOSTING",
        reason: "App Hosting PAYG hourly charge",
        idempotencyKey: `app-payg:${input.stackId}:${hourKey}`,
        metadata: {
          stackId: input.stackId,
          occurredAt: input.occurredAt.toISOString(),
        },
        line: {
          description: "App Hosting PAYG runtime hour",
          quantity: new Prisma.Decimal(1),
          unitPrice: input.hourlyCost,
          lineType: "USAGE",
        },
      })

      return { ...result, graceEntered: false }
    } catch (error) {
      if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
        await this.enterGrace(input.stackId)
        return {
          billingAccountId: account.id,
          adjustmentId: "",
          balanceBefore: account.balance,
          balanceAfter: account.balance,
          amount: input.hourlyCost,
          currency: account.currency,
          alreadyProcessed: false,
          graceEntered: true,
        }
      }
      throw error
    }
  }

  /**
   * Charge monthly package upfront through the billing foundation.
   */
  async chargeMonthlyPackage(input: {
    organizationId: string
    amount: Prisma.Decimal
    subscriptionId: string
    stackId: string
    idempotencyKey: string
  }) {
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")

    return this.transactions.debitServiceBalance({
      organizationId: input.organizationId,
      amount: input.amount,
      currency: account.currency,
      source: "PACKAGE",
      reason: "App Hosting monthly package payment",
      idempotencyKey: input.idempotencyKey,
      metadata: {
        subscriptionId: input.subscriptionId,
        stackId: input.stackId,
      },
      line: {
        description: "App Hosting monthly package",
        quantity: new Prisma.Decimal(1),
        unitPrice: input.amount,
        lineType: "SUBSCRIPTION",
      },
    })
  }

  /**
   * Check if a stack in PAYMENT_GRACE has exceeded the 24-hour window.
   * If so, suspend the app.
   */
  async checkGraceAndSuspend(input: {
    stackId: string
  }): Promise<GraceCheckResult> {
    const stack = await this.prisma.applicationStack.findUnique({
      where: { id: input.stackId },
    })
    if (!stack) return { suspended: false }

    const meta = (stack.metadataJson ?? {}) as Record<string, unknown>
    if (meta.billingState !== "PAYMENT_GRACE") return { suspended: false }

    const graceStartedAt = meta.billingGraceStartedAt
      ? new Date(meta.billingGraceStartedAt as string)
      : null
    if (!graceStartedAt) return { suspended: false }

    const elapsed = Date.now() - graceStartedAt.getTime()
    if (elapsed < GRACE_PERIOD_MS) return { suspended: false }

    // Grace expired — suspend the app
    await this.prisma.applicationStack.update({
      where: { id: input.stackId },
      data: {
        status: "SUSPENDED",
        metadataJson: {
          ...meta,
          billingState: "SUSPENDED",
          billingSuspendedAt: new Date().toISOString(),
        },
      },
    })

    return { suspended: true }
  }

  /**
   * Clear PAYMENT_GRACE if the organization now has sufficient balance
   * to cover at least one hour of runtime.
   */
  async clearGraceIfFunded(input: {
    stackId: string
    organizationId: string
    hourlyCost: Prisma.Decimal
  }): Promise<GraceClearResult> {
    const stack = await this.prisma.applicationStack.findUnique({
      where: { id: input.stackId },
    })
    if (!stack) return { cleared: false }

    const meta = (stack.metadataJson ?? {}) as Record<string, unknown>
    if (meta.billingState !== "PAYMENT_GRACE") return { cleared: false }

    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) return { cleared: false }

    // Need at least one hour of balance to resume
    if (account.balance.lt(input.hourlyCost)) return { cleared: false }

    const { billingState: _, billingGraceStartedAt: __, ...restMeta } = meta
    await this.prisma.applicationStack.update({
      where: { id: input.stackId },
      data: {
        metadataJson: {
          ...restMeta,
          billingState: "ACTIVE",
          billingGraceClearedAt: new Date().toISOString(),
        },
      },
    })

    return { cleared: true }
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async enterGrace(stackId: string) {
    const stack = await this.prisma.applicationStack.findUnique({
      where: { id: stackId },
    })
    if (!stack) return

    const meta = (stack.metadataJson ?? {}) as Record<string, unknown>
    await this.prisma.applicationStack.update({
      where: { id: stackId },
      data: {
        metadataJson: {
          ...meta,
          billingState: "PAYMENT_GRACE",
          billingGraceStartedAt: new Date().toISOString(),
        },
      },
    })
  }
}
