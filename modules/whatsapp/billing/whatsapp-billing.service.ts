import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"

// ─── Types ──────────────────────────────────────────────────────────────

export type WhatsappBillingDecision =
  | { kind: "ALLOWANCE"; remainingAllowance: number }
  | { kind: "OVERAGE_CHARGED"; charged: Prisma.Decimal; adjustmentId: string }

export type MonthlyBaseInput = {
  organizationId: string
  deviceId: string
  amount: Prisma.Decimal
  allowance: number
  period: string
}

export type OverageInput = {
  organizationId: string
  deviceId: string
  messageCount: number
  unitPrice: Prisma.Decimal
  idempotencyKey: string
}

// ─── Service ────────────────────────────────────────────────────────────

export class WhatsappBillingService {
  constructor(
    private prisma: PrismaClient,
    private transactions: BillingTransactionService
  ) {}

  /**
   * Charge monthly base price from balance and reset allowance.
   * Idempotent via BillingTransactionService's idempotency key.
   */
  async chargeMonthlyBase(input: MonthlyBaseInput) {
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")

    const result = await this.transactions.debitServiceBalance({
      organizationId: input.organizationId,
      amount: input.amount,
      currency: account.currency,
      source: "WHATSAPP",
      reason: "WhatsApp monthly base payment",
      idempotencyKey: `wa-base:${input.deviceId}:${input.period}`,
      metadata: {
        deviceId: input.deviceId,
        period: input.period,
        allowance: input.allowance,
      },
      line: {
        description: "WhatsApp monthly base",
        quantity: new Prisma.Decimal(1),
        unitPrice: input.amount,
        lineType: "SUBSCRIPTION",
      },
    })

    // Reset allowance — even if alreadyProcessed, ensure allowance is set
    // (idempotent update: setting to the same value is safe)
    await this.prisma.whatsappDevice.update({
      where: { id: input.deviceId },
      data: { quotaBaseOut: input.allowance },
    })

    return result
  }

  /**
   * Consume monthly allowance or charge overage from balance.
   *
   * Phase 1 — Atomic allowance consumption (DB-enforced via updateMany with
   *   WHERE quotaBaseOut >= messageCount). Eliminates the read-check-update
   *   race window entirely.
   * Phase 2 — Re-read current state and validate billing account exists
   *   BEFORE any allowance mutation.
   * Phase 3 — Charge overage FIRST, then zero remaining allowance.
   *   This ordering guarantees: if the charge fails (INSUFFICIENT_BALANCE),
   *   NO allowance state has been changed — the caller can retry safely.
   *
   * WhatsApp has NO grace period — reject immediately if balance insufficient.
   */
  async consumeAllowanceOrChargeOverage(
    input: OverageInput
  ): Promise<WhatsappBillingDecision> {
    // ── Phase 1: Atomic allowance consumption ──────────────────────────
    const atomicResult = await this.prisma.whatsappDevice.updateMany({
      where: { id: input.deviceId, quotaBaseOut: { gte: input.messageCount } },
      data: { quotaBaseOut: { decrement: input.messageCount } },
    })

    if (atomicResult.count > 0) {
      const updatedDevice = await this.prisma.whatsappDevice.findUnique({
        where: { id: input.deviceId },
        select: { quotaBaseOut: true },
      })
      return {
        kind: "ALLOWANCE",
        remainingAllowance: updatedDevice?.quotaBaseOut ?? 0,
      }
    }

    // ── Phase 2: Re-read current state & validate ─────────────────────
    const device = await this.prisma.whatsappDevice.findUnique({
      where: { id: input.deviceId },
    })
    if (!device) throw new Error("WHATSAPP_DEVICE_NOT_FOUND")

    const currentAllowance = device.quotaBaseOut ?? 0
    const overageCount = input.messageCount - Math.max(currentAllowance, 0)

    // Validate billing account BEFORE any state mutation
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")

    // ── Phase 3: Charge overage FIRST, then mutate state ──────────────
    const amount = input.unitPrice.times(overageCount)

    // This will throw INSUFFICIENT_BALANCE if balance < amount.
    // Because we haven't mutated allowance state yet, a failed charge
    // means the caller can retry safely with no side effects.
    const result = await this.transactions.debitServiceBalance({
      organizationId: input.organizationId,
      amount,
      currency: account.currency,
      source: "WHATSAPP",
      reason: "WhatsApp overage charge",
      idempotencyKey: input.idempotencyKey,
      metadata: {
        deviceId: input.deviceId,
        messageCount: input.messageCount,
        overageCount,
      },
      line: {
        description: "WhatsApp overage messages",
        quantity: new Prisma.Decimal(overageCount),
        unitPrice: input.unitPrice,
        lineType: "USAGE",
      },
    })

    // Only now (charge succeeded) zero out remaining allowance
    if (currentAllowance > 0) {
      await this.prisma.whatsappDevice.update({
        where: { id: input.deviceId },
        data: { quotaBaseOut: 0 },
      })
    }

    return {
      kind: "OVERAGE_CHARGED",
      charged: amount,
      adjustmentId: result.adjustmentId,
    }
  }

  /**
   * Restore consumed allowance (e.g., after Meta API failure).
   * Best-effort: if another message consumed allowance concurrently,
   * the restore may overshoot. Acceptable because:
   * 1. Worst case is a slightly higher allowance this period
   * 2. The monthly reset caps it anyway
   * 3. The alternative (lost allowance + failed message) is worse
   */
  async restoreAllowance(deviceId: string, amount: number): Promise<void> {
    await this.prisma.whatsappDevice.update({
      where: { id: deviceId },
      data: { quotaBaseOut: { increment: amount } },
    })
  }
}
