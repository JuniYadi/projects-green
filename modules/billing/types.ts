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

export class BillingAccountNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`BillingAccount not found for tenant=${tenantId}`);
    this.name = "BillingAccountNotFoundError";
  }
}

export class SubscriptionNotFoundError extends Error {
  constructor(subscriptionId: string) {
    super(`Subscription not found: ${subscriptionId}`);
    this.name = "SubscriptionNotFoundError";
  }
}

export class InvalidSubscriptionBillingModeError extends Error {
  constructor(subscriptionId: string, expected: string, actual: string) {
    super(`Subscription ${subscriptionId} is ${actual}, expected ${expected}`);
    this.name = "InvalidSubscriptionBillingModeError";
  }
}

export class SubscriptionInactiveError extends Error {
  constructor(subscriptionId: string) {
    super(`Subscription ${subscriptionId} is not ACTIVE`);
    this.name = "SubscriptionInactiveError";
  }
}

export class CalcPaygOnNonPaygError extends Error {
  constructor() {
    super("calcPaygCost called on non-PAYG pricing");
    this.name = "CalcPaygOnNonPaygError";
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
