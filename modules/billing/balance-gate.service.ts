import { PrismaClient, BillingMode, SubscriptionType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import Decimal = Prisma.Decimal;
import {
  MINIMUM_BALANCE_WARN_IDR,
  roundCpu,
  roundMem,
} from "./constants";
import {
  InsufficientBalanceError,
  NegativeBalanceError,
  PricingNotFoundError,
  ChargeResult,
  PricingLookup,
  SubscriptionNotFoundError,
  InvalidSubscriptionBillingModeError,
  SubscriptionInactiveError,
  CalcPaygOnNonPaygError,
  BillingAccountNotFoundError,
} from "./types";

export class BalanceGateService {
  constructor(private prisma: PrismaClient) {}

  // ─── Balance queries ─────────────────────────────────────────────────────────

  async getBalance(organizationId: string): Promise<Decimal> {
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId },
      select: { balance: true },
    });
    if (!account) {
      throw new BillingAccountNotFoundError(organizationId);
    }
    return account.balance;
  }

  async isBalancePositive(organizationId: string): Promise<boolean> {
    return (await this.getBalance(organizationId)).gt(0);
  }

  async isBalanceAboveWarn(organizationId: string): Promise<boolean> {
    const account = await this.prisma.billingAccount.findUnique({
      where: { organizationId },
      select: { balance: true, currency: true },
    });
    if (!account) {
      throw new BillingAccountNotFoundError(organizationId);
    }
    const warnThreshold = await this.getWarnThreshold(account.currency);
    return account.balance.gte(warnThreshold);
  }

  /**
   * Per-currency low-balance warning threshold sourced from the Currency table.
   * Falls back to the base-currency constant when the currency row is missing.
   */
  private async getWarnThreshold(currencyCode: string): Promise<Decimal> {
    const currencyRow = await this.prisma.paymentCurrency.findUnique({
      where: { code: currencyCode },
      select: { minBalanceWarn: true },
    });
    return currencyRow?.minBalanceWarn ?? new Decimal(MINIMUM_BALANCE_WARN_IDR);
  }

  // ─── ServicePricing lookup ──────────────────────────────────────────────────

  /**
   * Find the active ServicePricing record for a given plan+region+type+billingMode.
   */
  async findPricing(opts: {
    planId: string;
    regionId: string;
    type: SubscriptionType;
    billingMode: BillingMode;
  }): Promise<PricingLookup> {
    const row = await this.prisma.servicePricing.findFirst({
      where: {
        planId: opts.planId,
        regionId: opts.regionId,
        type: opts.type,
        billingMode: opts.billingMode,
        isActive: true,
      },
      include: {
        servicePlan: { select: { code: true, packageId: true, resources: true } },
        region: { select: { code: true } },
      },
    });

    if (!row) {
      throw new PricingNotFoundError(
        opts.planId,
        opts.regionId,
        opts.type,
        opts.billingMode,
      );
    }

    return {
      pricingId: row.id,
      planId: row.planId,
      planCode: row.servicePlan.code,
      packageCode: row.servicePlan.packageId,
      regionCode: row.region.code,
      type: row.type,
      billingMode: row.billingMode,
      basePriceIdr: row.basePriceIdr,
      monthlyCapIdr: row.monthlyCapIdr,
      unitRateCpu: row.unitRateCpu,
      unitRateMem: row.unitRateMem,
      unitRateMessage: row.unitRateMessage,
    };
  }

  // ─── PAYG computation ───────────────────────────────────────────────────────

  /**
   * Calculate monthly PAYG cost for App Hosting given CPU (mCPU) and Memory (MB).
   */
  calcPaygCost(pricing: PricingLookup, mcpu: number, memMb: number): Decimal {
    if (pricing.billingMode !== "PAYG") {
      throw new CalcPaygOnNonPaygError();
    }

    let total = new Decimal(0);

    if (pricing.unitRateCpu) {
      total = total.plus(
        new Decimal(roundCpu(mcpu)).times(pricing.unitRateCpu),
      );
    }

    if (pricing.unitRateMem) {
      total = total.plus(
        new Decimal(roundMem(memMb)).times(pricing.unitRateMem),
      );
    }

    // Apply monthly cap if set
    if (pricing.monthlyCapIdr && total.gt(pricing.monthlyCapIdr)) {
      return pricing.monthlyCapIdr;
    }

    return total;
  }

  // ─── Balance mutations ───────────────────────────────────────────────────────

  private async deductCore(
    organizationId: string,
    amount: Decimal,
    description: string,
    type: "CREDIT" | "DEBIT",
    metadata?: object,
  ): Promise<ChargeResult> {
    const MAX_BALANCE = new Decimal("999999999.99");

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.billingAccount.findUnique({
        where: { organizationId },
      });
      if (!account) {
        throw new BillingAccountNotFoundError(organizationId);
      }

      const balanceBefore = account.balance;
      const balanceAfter =
        type === "CREDIT"
          ? balanceBefore.plus(amount)
          : balanceBefore.minus(amount);

      if (balanceAfter.lt(0)) {
        throw new NegativeBalanceError();
      }

      if (balanceAfter.gt(MAX_BALANCE)) {
        throw new Error("BALANCE_LIMIT_EXCEEDED");
      }

      const [updated, adjustment] = await Promise.all([
        tx.billingAccount.update({
          where: { id: account.id },
          data: { balance: balanceAfter },
        }),
        tx.billingAdjustment.create({
          data: {
            billingAccountId: account.id,
            adjustmentType: type,
            amount: amount,
            currency: account.currency,
            reason: description,
            metadataJson: metadata ?? undefined,
          },
        }),
      ]);

      return {
        balanceBefore,
        balanceAfter: updated.balance,
        charged: amount,
        adjustmentId: adjustment.id,
      };
    });
  }

  async addCredit(
    organizationId: string,
    amount: Decimal,
    description: string,
    metadata?: object,
  ): Promise<ChargeResult> {
    return this.deductCore(organizationId, amount, description, "CREDIT", metadata);
  }

  async deductBalance(
    organizationId: string,
    amount: Decimal,
    description: string,
    metadata?: object,
  ): Promise<ChargeResult> {
    return this.deductCore(organizationId, amount, description, "DEBIT", metadata);
  }

  // ─── Enforced billing flow ─────────────────────────────────────────────────

  /**
   * For PAYG subscriptions: check balance, deduct computed cost.
   */
  async chargePayg(
    organizationId: string,
    subscriptionId: string,
  ): Promise<ChargeResult> {
    // 1. Fetch subscription with pricing
    const sub = await this.prisma.serviceSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        pricing: {
          include: {
            servicePlan: { select: { code: true, packageId: true } },
            region: { select: { code: true } },
          },
        },
      },
    });

    if (!sub) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }
    if (sub.billingMode !== "PAYG") {
      throw new InvalidSubscriptionBillingModeError(
        subscriptionId,
        "PAYG",
        sub.billingMode,
      );
    }
    if (sub.status !== "ACTIVE") {
      throw new SubscriptionInactiveError(subscriptionId);
    }

    // Validate allocatedConfig structure before using
    const rawConfig = sub.allocatedConfig;
    if (rawConfig !== null && typeof rawConfig === "object") {
      const keys = Object.keys(rawConfig);
      const hasValidKeys = keys.some((k) => k === "cpu" || k === "mem");
      if (!hasValidKeys && Object.keys(rawConfig).length > 0) {
        throw new Error(
          `allocatedConfig has unexpected keys: ${keys.join(", ")}`,
        );
      }
    }

    // 2. Calculate cost from DB-stored rates
    const config = sub.allocatedConfig as { cpu?: number; mem?: number } | null;
    const mcpu = config?.cpu ?? 0;
    const memMb = config?.mem ?? 0;

    const pricing: PricingLookup = {
      pricingId: sub.pricingId,
      planId: sub.pricing.planId,
      planCode: sub.pricing.servicePlan.code,
      packageCode: sub.pricing.servicePlan.packageId,
      regionCode: sub.pricing.region.code,
      type: sub.pricing.type,
      billingMode: sub.pricing.billingMode,
      basePriceIdr: sub.pricing.basePriceIdr,
      monthlyCapIdr: sub.pricing.monthlyCapIdr,
      unitRateCpu: sub.pricing.unitRateCpu,
      unitRateMem: sub.pricing.unitRateMem,
      unitRateMessage: sub.pricing.unitRateMessage,
    };

    const amount = this.calcPaygCost(pricing, mcpu, memMb);

    // Use a SINGLE transaction for balance check + deduction to prevent race
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.billingAccount.findUnique({
        where: { organizationId },
      });
      if (!account) {
        throw new BillingAccountNotFoundError(organizationId);
      }

      if (account.balance.lt(amount)) {
        throw new InsufficientBalanceError(amount, account.balance);
      }

      const balanceAfter = account.balance.minus(amount);

      const [updated, adjustment] = await Promise.all([
        tx.billingAccount.update({
          where: { id: account.id },
          data: { balance: balanceAfter },
        }),
        tx.billingAdjustment.create({
          data: {
            billingAccountId: account.id,
            adjustmentType: "DEBIT",
            amount,
            currency: account.currency,
            reason: `PAYG charge: ${sub.pricing.servicePlan.code} (${mcpu}mCPU / ${memMb}MB)`,
            metadataJson: {
              subscriptionId,
              pricingId: sub.pricingId,
              cpu: mcpu,
              mem: memMb,
              computedCost: amount.toString(),
            },
          },
        }),
      ]);

      return {
        balanceBefore: account.balance,
        balanceAfter: updated.balance,
        charged: amount,
        adjustmentId: adjustment.id,
      };
    });
  }

  /**
   * For PACKAGE/BUNDLE subscriptions: deduct the fixed basePriceIdr from ServicePricing table.
   */
  async chargePackage(
    organizationId: string,
    subscriptionId: string,
  ): Promise<ChargeResult> {
    const sub = await this.prisma.serviceSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        pricing: {
          include: {
            servicePlan: { select: { code: true, packageId: true } },
            region: { select: { code: true } },
          },
        },
      },
    });

    if (!sub) {
      throw new SubscriptionNotFoundError(subscriptionId);
    }
    if (sub.billingMode !== "PACKAGE") {
      throw new InvalidSubscriptionBillingModeError(
        subscriptionId,
        "PACKAGE",
        sub.billingMode,
      );
    }
    if (sub.status !== "ACTIVE") {
      throw new SubscriptionInactiveError(subscriptionId);
    }

    const amount = sub.pricing.basePriceIdr;

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.billingAccount.findUnique({
        where: { organizationId },
      });
      if (!account) {
        throw new BillingAccountNotFoundError(organizationId);
      }

      if (account.balance.lt(amount)) {
        throw new InsufficientBalanceError(amount, account.balance);
      }

      const balanceAfter = account.balance.minus(amount);

      const [updated, adjustment] = await Promise.all([
        tx.billingAccount.update({
          where: { id: account.id },
          data: { balance: balanceAfter },
        }),
        tx.billingAdjustment.create({
          data: {
            billingAccountId: account.id,
            adjustmentType: "DEBIT",
            amount,
            currency: account.currency,
            reason: `ServicePackage charge: ${sub.pricing.servicePlan.code} (${sub.pricing.region.code})`,
            metadataJson: {
              subscriptionId,
              pricingId: sub.pricingId,
              planCode: sub.pricing.servicePlan.code,
            },
          },
        }),
      ]);

      return {
        balanceBefore: account.balance,
        balanceAfter: updated.balance,
        charged: amount,
        adjustmentId: adjustment.id,
      };
    });
  }

  /**
   * For VPN and WhatsApp flat subscriptions.
   */
  async chargeFlatMonthly(
    organizationId: string,
    subscriptionId: string,
  ): Promise<ChargeResult> {
    return this.chargePackage(organizationId, subscriptionId);
  }
}
