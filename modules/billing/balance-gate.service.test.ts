import { describe, expect, it, vi, beforeEach } from "bun:test";
import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import Decimal = Prisma.Decimal;
import { BalanceGateService } from "./balance-gate.service";
import {
  InsufficientBalanceError,
  NegativeBalanceError,
  PricingNotFoundError,
  PricingLookup,
} from "./types";

// Create a mock PrismaClient
const mockPrisma = {
  billingAccount: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  billingAdjustment: {
    create: vi.fn(),
  },
  pricing: {
    findFirst: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

describe("BalanceGateService", () => {
  let service: BalanceGateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BalanceGateService(mockPrisma);
  });

  describe("Balance queries", () => {
    it("getBalance returns DB value", async () => {
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        tenantId: "tenant-1",
        balance: new Decimal(50_000),
      } as never);

      const balance = await service.getBalance("tenant-1");
      expect(balance.toNumber()).toBe(50_000);
      expect(mockPrisma.billingAccount.findUnique).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1" },
        select: { balance: true },
      });
    });

    it("isBalancePositive true when balance=1", async () => {
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        balance: new Decimal(1),
      } as never);

      const result = await service.isBalancePositive("tenant-1");
      expect(result).toBe(true);
    });

    it("isBalancePositive false when balance=0", async () => {
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        balance: new Decimal(0),
      } as never);

      const result = await service.isBalancePositive("tenant-1");
      expect(result).toBe(false);
    });

    it("isBalanceAboveWarn true when balance=50_000", async () => {
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        balance: new Decimal(50_000),
      } as never);

      const result = await service.isBalanceAboveWarn("tenant-1");
      expect(result).toBe(true);
    });

    it("isBalanceAboveWarn false when balance=5_000", async () => {
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        balance: new Decimal(5_000),
      } as never);

      const result = await service.isBalanceAboveWarn("tenant-1");
      expect(result).toBe(false);
    });
  });

  describe("Balance mutations", () => {
    it("addCredit increases balance", async () => {
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(10_000),
      } as never);

      (mockPrisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { balance: new Decimal(15_000) },
        { id: "adj-1" },
      ]);

      const result = await service.addCredit(
        "tenant-1",
        new Decimal(5_000),
        "Test credit",
      );

      expect(result.balanceBefore.toNumber()).toBe(10_000);
      expect(result.balanceAfter.toNumber()).toBe(15_000);
      expect(result.charged.toNumber()).toBe(5_000);
      expect(result.adjustmentId).toBe("adj-1");

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("deductBalance below zero throws NegativeBalanceError", async () => {
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(10_000),
      } as never);

      await expect(
        service.deductBalance("tenant-1", new Decimal(15_000), "Test deduct"),
      ).rejects.toThrow(NegativeBalanceError);
    });
  });

  describe("Enforced billing flow", () => {
    const mockPricingLookup: PricingLookup = {
      pricingId: "price-1",
      planId: "plan-1",
      planCode: "STANDARD",
      packageCode: "APP_HOSTING",
      regionCode: "INDONESIA",
      type: "PAYG",
      billingMode: "PAYG",
      basePriceIdr: new Decimal(0),
      monthlyCapIdr: null,
      unitRateCpu: new Decimal(10), // 10 IDR per mCPU
      unitRateMem: new Decimal(5), // 5 IDR per MB
      unitRateMessage: null,
    };

    const mockPaygSubscription = {
      id: "sub-1",
      billingMode: "PAYG",
      status: "ACTIVE",
      pricingId: "price-1",
      allocatedConfig: { cpu: 150, mem: 200 },
      pricing: {
        id: "price-1",
        planId: "plan-1",
        type: "PAYG",
        billingMode: "PAYG",
        basePriceIdr: new Decimal(0),
        monthlyCapIdr: null,
        unitRateCpu: new Decimal(10),
        unitRateMem: new Decimal(5),
        unitRateMessage: null,
        servicePlan: { code: "STANDARD" },
        region: { code: "INDONESIA" },
      },
    };

    it("chargePayg deducts computed cost", async () => {
      // Setup mock subscription
      (mockPrisma.subscription.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockPaygSubscription as never,
      );

      // Setup mock balance (50_000 available)
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(50_000),
      } as never); // for getBalance

      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(50_000),
      } as never); // for deductCore

      // 150mCPU -> round up to 200 -> 200 * 10 = 2000
      // 200MB -> round up to 256 -> 256 * 5 = 1280
      // Total = 3280

      (mockPrisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { balance: new Decimal(50_000 - 3280) },
        { id: "adj-1" },
      ]);

      const result = await service.chargePayg("tenant-1", "sub-1");

      expect(result.charged.toNumber()).toBe(3280);
      expect(result.balanceAfter.toNumber()).toBe(50_000 - 3280);
    });

    it("chargePayg rounds CPU to 100m", () => {
      // Just test the internal math
      const cost = service.calcPaygCost(mockPricingLookup, 150, 0);
      // CPU: 150 -> min 200 * 10 = 2000
      // MEM: 0 -> min 128 * 5 = 640
      // Total = 2640
      expect(cost.toNumber()).toBe(2640);
    });

    it("chargePayg rounds MEM to 128MB", () => {
      const cost = service.calcPaygCost(mockPricingLookup, 0, 200);
      // CPU: 0 -> min 100 * 10 = 1000
      // MEM: 200 -> 256 * 5 = 1280
      // Total = 2280
      expect(cost.toNumber()).toBe(2280);
    });

    it("chargePayg insufficient balance", async () => {
      (mockPrisma.subscription.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockPaygSubscription as never,
      );

      // Balance = 1000, needed = 3280
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        balance: new Decimal(1000),
      } as never);

      await expect(service.chargePayg("tenant-1", "sub-1")).rejects.toThrow(
        InsufficientBalanceError,
      );
    });

    it("chargePayg exact balance allowed", async () => {
      (mockPrisma.subscription.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockPaygSubscription as never,
      );

      // Balance = 3280, needed = 3280
      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(3280),
      } as never);

      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(3280),
      } as never);

      (mockPrisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { balance: new Decimal(0) },
        { id: "adj-1" },
      ]);

      const result = await service.chargePayg("tenant-1", "sub-1");
      expect(result.charged.toNumber()).toBe(3280);
      expect(result.balanceAfter.toNumber()).toBe(0);
    });

    it("chargePayg respects monthly cap", () => {
      const pricingWithCap = {
        ...mockPricingLookup,
        monthlyCapIdr: new Decimal(2500),
      };

      // Cost without cap would be 3280
      const cost = service.calcPaygCost(pricingWithCap, 150, 200);

      expect(cost.toNumber()).toBe(2500);
    });

    const mockPackageSubscription = {
      id: "sub-pkg",
      billingMode: "PACKAGE",
      status: "ACTIVE",
      pricingId: "price-pkg",
      pricing: {
        id: "price-pkg",
        basePriceIdr: new Decimal(100_000),
        servicePlan: { code: "STANDARD" },
        region: { code: "GLOBAL" },
      },
    };

    it("chargePackage deducts basePriceIdr", async () => {
      (mockPrisma.subscription.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockPackageSubscription as never,
      );

      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(150_000),
      } as never);

      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(150_000),
      } as never);

      (mockPrisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { balance: new Decimal(50_000) },
        { id: "adj-1" },
      ]);

      const result = await service.chargePackage("tenant-1", "sub-pkg");

      expect(result.charged.toNumber()).toBe(100_000);
    });

    it("chargePackage insufficient", async () => {
      (mockPrisma.subscription.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockPackageSubscription as never,
      );

      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        balance: new Decimal(50_000),
      } as never);

      await expect(service.chargePackage("tenant-1", "sub-pkg")).rejects.toThrow(
        InsufficientBalanceError,
      );
    });

    it("chargeFlatMonthly delegates to chargePackage", async () => {
      (mockPrisma.subscription.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockPackageSubscription as never,
      );

      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(150_000),
      } as never);

      (mockPrisma.billingAccount.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "acc-1",
        balance: new Decimal(150_000),
      } as never);

      (mockPrisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { balance: new Decimal(50_000) },
        { id: "adj-1" },
      ]);

      const result = await service.chargeFlatMonthly("tenant-1", "sub-pkg");

      expect(result.charged.toNumber()).toBe(100_000);
    });
  });

  describe("findPricing", () => {
    it("returns mapped PricingLookup", async () => {
      (mockPrisma.pricing.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "price-1",
        planId: "plan-1",
        regionId: "reg-1",
        type: "PAYG",
        billingMode: "PAYG",
        basePriceIdr: new Decimal(0),
        monthlyCapIdr: null,
        unitRateCpu: new Decimal(10),
        unitRateMem: new Decimal(5),
        unitRateMessage: null,
        servicePlan: { code: "STANDARD", packageId: "pkg-1", resources: {} },
        region: { code: "INDONESIA" },
      } as never);

      const pricing = await service.findPricing({
        planId: "plan-1",
        regionId: "reg-1",
        type: "PAYG",
        billingMode: "PAYG",
      });

      expect(pricing.pricingId).toBe("price-1");
      expect(pricing.packageCode).toBe("pkg-1");
      expect(pricing.planCode).toBe("STANDARD");
      expect(pricing.unitRateCpu?.toNumber()).toBe(10);
    });

    it("throws PricingNotFoundError when not found", async () => {
      (mockPrisma.pricing.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

      await expect(
        service.findPricing({
          planId: "plan-1",
          regionId: "reg-1",
          type: "PAYG",
          billingMode: "PAYG",
        }),
      ).rejects.toThrow(PricingNotFoundError);
    });
  });
});
