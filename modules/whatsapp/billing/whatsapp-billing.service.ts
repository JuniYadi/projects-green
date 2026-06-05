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
    private transactions: BillingTransactionService,
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
   * - If allowance is sufficient: decrement allowance, no balance change.
   * - If allowance is partially sufficient: consume remaining allowance,
   *   then charge overage messages immediately.
   * - If allowance is exhausted: charge all messages as overage.
   * - If balance is insufficient for overage: throw INSUFFICIENT_BALANCE.
   *
   * WhatsApp has NO grace period — reject immediately if balance insufficient.
   */
  async consumeAllowanceOrChargeOverage(
    input: OverageInput,
  ): Promise<WhatsappBillingDecision> {
    const device = await this.prisma.whatsappDevice.findUnique({
      where: { id: input.deviceId },
    })
    if (!device) throw new Error("WHATSAPP_DEVICE_NOT_FOUND")

    const allowance = device.quotaBaseOut ?? 0

    // Case 1: Full allowance covers the message(s)
    if (allowance >= input.messageCount) {
      const updated = await this.prisma.whatsappDevice.update({
        where: { id: input.deviceId },
        data: { quotaBaseOut: allowance - input.messageCount },
      })
      return { kind: "ALLOWANCE", remainingAllowance: updated.quotaBaseOut }
    }

    // Case 2: Partial allowance + overage needed
    const overageCount = input.messageCount - Math.max(allowance, 0)

    if (allowance > 0) {
      // Zero out remaining allowance
      await this.prisma.whatsappDevice.update({
        where: { id: input.deviceId },
        data: { quotaBaseOut: 0 },
      })
    }

    // Charge overage via billing foundation
    const amount = input.unitPrice.times(overageCount)

    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId: input.organizationId },
    })
    if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")

    // This will throw INSUFFICIENT_BALANCE if balance < amount
    // WhatsApp does NOT enter grace — reject immediately
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

    return {
      kind: "OVERAGE_CHARGED",
      charged: amount,
      adjustmentId: result.adjustmentId,
    }
  }
}
