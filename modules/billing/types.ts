import { Prisma } from "@prisma/client";

export class InsufficientBalanceError extends Error {
  readonly required: Prisma.Decimal;
  readonly available: Prisma.Decimal;

  constructor(required: Prisma.Decimal, available: Prisma.Decimal) {
    super(`Insufficient balance: need ${required} IDR, have ${available} IDR`);
    this.required = required;
    this.available = available;
    this.name = "InsufficientBalanceError";
  }
}

export class NegativeBalanceError extends Error {
  constructor() {
    super("Operation would result in negative balance");
    this.name = "NegativeBalanceError";
  }
}

export class PricingNotFoundError extends Error {
  constructor(
    planId: string,
    regionId: string,
    type: string,
    billingMode: string,
  ) {
    super(
      `No active Pricing found for plan=${planId} region=${regionId} type=${type} billingMode=${billingMode}`,
    );
    this.name = "PricingNotFoundError";
  }
}

export interface ChargeResult {
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  charged: Prisma.Decimal;
  adjustmentId: string;
}

export interface PricingLookup {
  pricingId: string;
  planId: string;
  planCode: string;
  packageCode: string;
  regionCode: string;
  type: "PAYG" | "BUNDLE" | "CUSTOM";
  billingMode: "PACKAGE" | "PAYG" | "CUSTOM";
  basePriceIdr: Prisma.Decimal;
  monthlyCapIdr: Prisma.Decimal | null;
  unitRateCpu: Prisma.Decimal | null;
  unitRateMem: Prisma.Decimal | null;
  unitRateMessage: Prisma.Decimal | null;
}
