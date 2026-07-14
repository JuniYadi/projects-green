import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"
import { BillingTransactionService } from "@/modules/billing/billing-transaction.service"

// ─── Types ──────────────────────────────────────────────────────────────

export type WhatsappBillingDecision =
  | {
      kind: "ALLOWANCE"
      remainingDefaultAllowance: Prisma.Decimal
      remainingAddonAllowance: Prisma.Decimal
      defaultConsumed: Prisma.Decimal
      addonConsumed: Prisma.Decimal
    }
  | {
      kind: "OVERAGE_CHARGED"
      remainingDefaultAllowance: Prisma.Decimal
      remainingAddonAllowance: Prisma.Decimal
      defaultConsumed: Prisma.Decimal
      addonConsumed: Prisma.Decimal
      charged: Prisma.Decimal
      adjustmentId: string
    }

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
  quotaCredit: Prisma.Decimal
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

  async consumeAllowanceOrChargeOverage(
    input: OverageInput
  ): Promise<WhatsappBillingDecision> {
    return this.prisma.$transaction(async (tx) => {
      // Lock the device row to prevent concurrent consumption races
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "WhatsappDevice" WHERE id = ${input.deviceId} FOR UPDATE`
      )

      const device = await tx.whatsappDevice.findUnique({
        where: { id: input.deviceId },
        select: { quotaBaseOut: true, addonQuota: true },
      })
      if (!device) throw new Error("WHATSAPP_DEVICE_NOT_FOUND")

      const defaultRemaining = device.quotaBaseOut instanceof Prisma.Decimal
        ? device.quotaBaseOut
        : new Prisma.Decimal(Number(device.quotaBaseOut ?? 0))
      const addonRemaining = device.addonQuota instanceof Prisma.Decimal
        ? device.addonQuota
        : new Prisma.Decimal(Number(device.addonQuota ?? 0))
      const credit = input.quotaCredit

      // Case 1: Default allowance covers the full credit
      if (defaultRemaining.gte(credit)) {
        await tx.whatsappDevice.update({
          where: { id: input.deviceId },
          data: { quotaBaseOut: { decrement: credit } },
        })
        return {
          kind: "ALLOWANCE",
          remainingDefaultAllowance: defaultRemaining.minus(credit),
          remainingAddonAllowance: addonRemaining,
          defaultConsumed: credit,
          addonConsumed: new Prisma.Decimal(0),
        }
      }

      // Case 2: Default + addon cover the full credit
      const combined = defaultRemaining.plus(addonRemaining)
      if (combined.gte(credit)) {
        const addonNeed = credit.minus(defaultRemaining)
        await tx.whatsappDevice.update({
          where: { id: input.deviceId },
          data: {
            quotaBaseOut: new Prisma.Decimal(0),
            addonQuota: { decrement: addonNeed },
          },
        })
        return {
          kind: "ALLOWANCE",
          remainingDefaultAllowance: new Prisma.Decimal(0),
          remainingAddonAllowance: addonRemaining.minus(addonNeed),
          defaultConsumed: defaultRemaining,
          addonConsumed: addonNeed,
        }
      }

      // Case 3: Neither covers — charge overage from org balance
      const account = await tx.billingAccount.findUnique({
        where: { organizationId: input.organizationId },
      })
      if (!account) throw new Error("BILLING_ACCOUNT_NOT_FOUND")

      const overageCredit = credit.minus(combined)
      const amount = input.unitPrice.times(overageCredit)

      // Charge BEFORE mutating allowance — if charge fails, allowance is untouched
      const result = await this.transactions.debitServiceBalance({
        organizationId: input.organizationId,
        amount,
        currency: account.currency,
        source: "WHATSAPP",
        reason: "WhatsApp overage charge",
        idempotencyKey: input.idempotencyKey,
        metadata: {
          deviceId: input.deviceId,
          quotaCredit: input.quotaCredit.toString(),
          overageCredit: overageCredit.toString(),
        },
        line: {
          description: "WhatsApp overage quota credit",
          quantity: overageCredit,
          unitPrice: input.unitPrice,
          lineType: "USAGE",
        },
      })

      // Zero both allowances (charge succeeded)
      await tx.whatsappDevice.update({
        where: { id: input.deviceId },
        data: {
          quotaBaseOut: new Prisma.Decimal(0),
          addonQuota: new Prisma.Decimal(0),
        },
      })

      return {
        kind: "OVERAGE_CHARGED",
        remainingDefaultAllowance: new Prisma.Decimal(0),
        remainingAddonAllowance: new Prisma.Decimal(0),
        defaultConsumed: defaultRemaining,
        addonConsumed: addonRemaining,
        charged: amount,
        adjustmentId: result.adjustmentId,
      }
    })
  }
  /**
   * Restore consumed allowance (e.g., after Meta API failure).
   * Best-effort: if another message consumed allowance concurrently,
   * the restore may overshoot. Acceptable because:
   * 1. Worst case is a slightly higher allowance this period
   * 2. The monthly reset caps it anyway
   * 3. The alternative (lost allowance + failed message) is worse
   *
   * Only allowance (default/addon) can be restored; balance overages
   * are not auto-refunded (preserve existing behavior).
   */
  async restoreAllowance(
    deviceId: string,
    amounts: { default?: Prisma.Decimal | number; addon?: Prisma.Decimal | number }
  ): Promise<void> {
    const data: Record<string, unknown> = {}
    if (amounts.default !== undefined) {
      const credit = typeof amounts.default === "number" ? new Prisma.Decimal(amounts.default) : amounts.default
      data.quotaBaseOut = { increment: credit }
    }
    if (amounts.addon !== undefined) {
      const credit = typeof amounts.addon === "number" ? new Prisma.Decimal(amounts.addon) : amounts.addon
      data.addonQuota = { increment: credit }
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.whatsappDevice.update({
        where: { id: deviceId },
        data,
      })
    }
  }
}
