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
} from "./types";

export class BalanceGateService {
  constructor(private prisma: PrismaClient) {}

  // ─── Balance queries ─────────────────────────────────────────────────────────

  async getBalance(tenantId: string): Promise<Decimal> {
    const account = await this.prisma.billingAccount.findUnique({
      where: { tenantId },
      select: { balance: true },
    });
    if (!account) {
      throw new Error(`BillingAccount not found for tenant=${tenantId}`);
    }
    return account.balance;
  }

  async isBalancePositive(tenantId: string): Promise<boolean> {
    return (await this.getBalance(tenantId)).gt(0);
  }

  async isBalanceAboveWarn(tenantId: string): Promise<boolean> {
    return (await this.getBalance(tenantId)).gte(MINIMUM_BALANCE_WARN_IDR);
  }

  // ─── Pricing lookup ─────────────────────────────────────────────────────────

  /**
   * Find the active Pricing record for a given plan+region+type+billingMode.
   */
  async findPricing(opts: {
    planId: string;
    regionId: string;
    type: SubscriptionType;
    billingMode: BillingMode;
  }): Promise<PricingLookup> {
    const row = await this.prisma.pricing.findFirst({
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
      throw new Error("calcPaygCost called on non-PAYG pricing");
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
    tenantId: string,
    amount: Decimal,
    description: string,
    type: "CREDIT" | "DEBIT",
    metadata?: object,
  ): Promise<ChargeResult> {
    const account = await this.prisma.billingAccount.findUnique({
      where: { tenantId },
    });
    if (!account) {
      throw new Error(`BillingAccount not found for tenant=${tenantId}`);
    }

    const balanceBefore = account.balance;
    const balanceAfter =
      type === "CREDIT"
        ? balanceBefore.plus(amount)
        : balanceBefore.minus(amount);

    if (balanceAfter.lt(0)) {
      throw new NegativeBalanceError();
    }

    const [updated, adjustment] = await this.prisma.$transaction([
      this.prisma.billingAccount.update({
        where: { id: account.id },
        data: { balance: balanceAfter },
      }),
      this.prisma.billingAdjustment.create({
        data: {
          billingAccountId: account.id,
          adjustmentType: type,
          amount: amount,
          currency: "IDR",
          reason: description,
          metadataJson: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
      }),
    ]);

    return {
      balanceBefore,
      balanceAfter: updated.balance,
      charged: amount,
      adjustmentId: adjustment.id,
    };
  }

  async addCredit(
    tenantId: string,
    amount: Decimal,
    description: string,
    metadata?: object,
  ): Promise<ChargeResult> {
    return this.deductCore(tenantId, amount, description, "CREDIT", metadata);
  }

  async deductBalance(
    tenantId: string,
    amount: Decimal,
    description: string,
    metadata?: object,
  ): Promise<ChargeResult> {
    return this.deductCore(tenantId, amount, description, "DEBIT", metadata);
  }

  // ─── Enforced billing flow ─────────────────────────────────────────────────

  /**
   * For PAYG subscriptions: check balance, deduct computed cost.
   */
  async chargePayg(
    tenantId: string,
    subscriptionId: string,
  ): Promise<ChargeResult> {
    // 1. Fetch subscription with pricing
    const sub = await this.prisma.subscription.findUnique({
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
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    if (sub.billingMode !== "PAYG") {
      throw new Error(`Subscription ${subscriptionId} is not PAYG`);
    }
    if (sub.status !== "ACTIVE") {
      throw new Error(`Subscription ${subscriptionId} is not ACTIVE`);
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

    // 3. Check balance before deducting
    const balance = await this.getBalance(tenantId);
    if (balance.lt(amount)) {
      throw new InsufficientBalanceError(amount, balance);
    }

    // 4. Deduct
    return this.deductBalance(
      tenantId,
      amount,
      `PAYG charge: ${sub.pricing.servicePlan.code} (${mcpu}mCPU / ${memMb}MB)`,
      {
        subscriptionId,
        pricingId: sub.pricingId,
        cpu: mcpu,
        mem: memMb,
        computedCost: amount.toString(),
      },
    );
  }

  /**
   * For PACKAGE/BUNDLE subscriptions: deduct the fixed basePriceIdr from Pricing table.
   */
  async chargePackage(
    tenantId: string,
    subscriptionId: string,
  ): Promise<ChargeResult> {
    const sub = await this.prisma.subscription.findUnique({
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
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }
    if (sub.billingMode !== "PACKAGE") {
      throw new Error(`Subscription ${subscriptionId} is not PACKAGE`);
    }
    if (sub.status !== "ACTIVE") {
      throw new Error(`Subscription ${subscriptionId} is not ACTIVE`);
    }

    const amount = sub.pricing.basePriceIdr;
    const balance = await this.getBalance(tenantId);

    if (balance.lt(amount)) {
      throw new InsufficientBalanceError(amount, balance);
    }

    return this.deductBalance(
      tenantId,
      amount,
      `Package charge: ${sub.pricing.servicePlan.code} (${sub.pricing.region.code})`,
      {
        subscriptionId,
        pricingId: sub.pricingId,
        planCode: sub.pricing.servicePlan.code,
      },
    );
  }

  /**
   * For VPN and WhatsApp flat subscriptions.
   */
  async chargeFlatMonthly(
    tenantId: string,
    subscriptionId: string,
  ): Promise<ChargeResult> {
    return this.chargePackage(tenantId, subscriptionId);
  }
}
