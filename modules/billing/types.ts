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

// ─── Quota Gate Errors ─────────────────────────────────────────────────────────

export class QuotaExceededError extends Error {
  readonly organizationId: string;
  readonly deviceId: string;
  readonly direction: "IN" | "OUT";
  readonly monthlyLimit: number;
  readonly monthlyUsed: number;

  constructor(
    organizationId: string,
    deviceId: string,
    direction: "IN" | "OUT",
    monthlyLimit: number,
    monthlyUsed: number,
  ) {
    super(
      `Monthly ${direction === "IN" ? "inbound" : "outbound"} quota exceeded for org=${organizationId} device=${deviceId}: limit=${monthlyLimit} used=${monthlyUsed}`,
    );
    this.organizationId = organizationId;
    this.deviceId = deviceId;
    this.direction = direction;
    this.monthlyLimit = monthlyLimit;
    this.monthlyUsed = monthlyUsed;
    this.name = "QuotaExceededError";
  }
}

export class DailyLimitExceededError extends Error {
  readonly organizationId: string;
  readonly deviceId: string;
  readonly dailyLimit: number;
  readonly dailyUsed: number;

  constructor(
    organizationId: string,
    deviceId: string,
    dailyLimit: number,
    dailyUsed: number,
  ) {
    super(
      `Daily limit exceeded for org=${organizationId} device=${deviceId}: limit=${dailyLimit} used=${dailyUsed}`,
    );
    this.organizationId = organizationId;
    this.deviceId = deviceId;
    this.dailyLimit = dailyLimit;
    this.dailyUsed = dailyUsed;
    this.name = "DailyLimitExceededError";
  }
}

export class DeviceNotFoundError extends Error {
  readonly organizationId: string;
  readonly deviceId: string;

  constructor(organizationId: string, deviceId: string) {
    super(`WhatsApp device not found for org=${organizationId} device=${deviceId}`);
    this.organizationId = organizationId;
    this.deviceId = deviceId;
    this.name = "DeviceNotFoundError";
  }
}

export class OrganizationNotMappedError extends Error {
  readonly organizationId: string;

  constructor(organizationId: string) {
    super(`No billing account found for organization=${organizationId}`);
    this.organizationId = organizationId;
    this.name = "OrganizationNotMappedError";
  }
}

// ─── Quota Gate Interfaces ────────────────────────────────────────────────────

export interface WhatsAppPlanResources {
  quotaIn: number | null;
  quotaOut: number | null;
  dailyPerDevice: number | null;
  devices: number | null;
}

export interface QuotaCheckResult {
  allowed: boolean;
  direction: "IN" | "OUT";
  monthlyLimit: number | null; // null = unlimited
  monthlyUsed: number;
  dailyLimit: number | null; // null = unlimited
  dailyUsed: number;
  planCode: string;
  planResources: WhatsAppPlanResources;
}

export interface UsageLedgerEntry {
  category: string;
  amountIdr: Prisma.Decimal;
  metadata?: object;
}
