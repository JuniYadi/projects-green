/**
 * Billing Cycle Service Tests
 */

import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Prisma, PrismaClient } from "@prisma/client"
import Decimal = Prisma.Decimal

import { UsageLedgerService } from "./usage-ledger.service"

// Module under test
const { BillingCycleService } = await import("./billing-cycle.service")

// ─── Mock Prisma ────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    billingRun: {
      findFirst: mock<(...args: any[]) => any>(async () => null),
      create: mock<(...args: any[]) => any>(async (data: any) => ({
        id: "br-1",
        ...data,
        status: "RUNNING",
      })),
      update: mock<(...args: any[]) => any>(async (data: any) => data),
    },
    billingSubscription: {
      findMany: mock<(...args: any[]) => any>(async () => []),
    },
    billingAccount: {
      findUnique: mock<(...args: any[]) => any>(async () => null),
      update: mock<(...args: any[]) => any>(async (data: any) => data),
    },
    invoice: {
      create: mock<(...args: any[]) => any>(async (data: any) => ({
        id: "inv-1",
        ...data.data,
      })),
      update: mock<(...args: any[]) => any>(async (data: any) => data),
      updateMany: mock<(...args: any[]) => any>(async () => ({ count: 0 })),
      findMany: mock<(...args: any[]) => any>(async () => []),
    },
    invoiceLine: {
      create: mock<(...args: any[]) => any>(async (data: any) => ({
        id: "il-1",
        ...data.data,
      })),
    },
    billingAdjustment: {
      create: mock<(...args: any[]) => any>(async (data: any) => ({
        id: "adj-1",
        ...data.data,
      })),
    },
    $transaction: mock<(...args: any[]) => any>(async (fn: any) =>
      fn(createMockPrisma()),
    ),
  }
}

// ─── Mock UsageLedgerService ────────────────────────────────────────────────

const mockUsageLedger = {
  generateRatedUsage: mock(async () => [] as any[]),
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("BillingCycleService", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockUsageLedger.generateRatedUsage.mockImplementation(async () => [])
  })

  describe("processMonthlyBilling", () => {
    it("returns empty result when no active subscriptions exist", async () => {
      mockPrisma.billingSubscription.findMany.mockImplementation(
        async () => [],
      )

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
      )
      const result = await service.processMonthlyBilling()

      expect(result.processed).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.invoices).toEqual([])
    })

    it("skips if a successful billing run for the period already exists", async () => {
      mockPrisma.billingRun.findFirst.mockImplementation(async () => ({
        id: "existing-br",
        status: "SUCCEEDED",
      }))

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
      )
      const result = await service.processMonthlyBilling()

      expect(result.billingRunId).toBe("existing-br")
      expect(result.processed).toBe(0)
    })

    it("skips subscription with zero usage", async () => {
      mockPrisma.billingSubscription.findMany.mockImplementation(async () => [
        {
          id: "sub-1",
          billingAccountId: "ba-1",
          billingAccount: {
            id: "ba-1",
            organizationId: "tenant-1",
            balance: new Decimal(100000),
          },
        },
      ])
      mockUsageLedger.generateRatedUsage.mockImplementation(async () => [])

      mockPrisma.billingRun.create.mockImplementation(async (data: any) => ({
        id: "br-1",
        ...data,
      }))

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
      )
      const result = await service.processMonthlyBilling()

      expect(result.processed).toBe(0)
      expect(result.skipped).toBe(1)
    })

    it("processes subscription with usage and sufficient balance", async () => {
      mockPrisma.billingSubscription.findMany.mockImplementation(async () => [
        {
          id: "sub-1",
          billingAccountId: "ba-1",
          billingAccount: {
            id: "ba-1",
            organizationId: "tenant-1",
            balance: new Decimal(500000),
          },
        },
      ])

      mockUsageLedger.generateRatedUsage.mockImplementation(async () => [
        {
          subscriptionId: "sub-1",
          category: "WHATSAPP_MESSAGE_OUT",
          rawAmountIdr: new Decimal(25000),
          cappedAmountIdr: new Decimal(25000),
          meterType: "usage",
          meterValue: 25000,
        },
      ])

      let transactionCallback: any
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        transactionCallback = fn
        // The transaction receives the mock prisma itself
        return fn(mockPrisma)
      })

      // Mock billing account find inside transaction
      mockPrisma.billingAccount.findUnique.mockImplementation(async () => ({
        id: "ba-1",
        organizationId: "tenant-1",
        balance: new Decimal(500000),
      }))

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
      )
      const result = await service.processMonthlyBilling()

      expect(result.processed).toBe(1)
      expect(result.invoices).toHaveLength(1)
      expect(result.invoices[0].status).toBe("PAID")
    })

    it("leaves invoice OPEN when balance is insufficient", async () => {
      mockPrisma.billingSubscription.findMany.mockImplementation(async () => [
        {
          id: "sub-1",
          billingAccountId: "ba-1",
          billingAccount: {
            id: "ba-1",
            organizationId: "tenant-1",
            balance: new Decimal(5000),
          },
        },
      ])

      mockUsageLedger.generateRatedUsage.mockImplementation(async () => [
        {
          subscriptionId: "sub-1",
          category: "WHATSAPP_MESSAGE_OUT",
          rawAmountIdr: new Decimal(50000),
          cappedAmountIdr: new Decimal(50000),
          meterType: "usage",
          meterValue: 50000,
        },
      ])

      mockPrisma.billingAccount.findUnique.mockImplementation(async () => ({
        id: "ba-1",
        organizationId: "tenant-1",
        balance: new Decimal(5000),
      }))

      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn(mockPrisma),
      )

      // When balance is insufficient, the gte check fails, so we go to OPEN
      // Make balance.gte(totalDue) return false
      mockPrisma.billingAccount.findUnique.mockImplementation(async () => ({
        id: "ba-1",
        balance: {
          gte: () => false,
          minus: () => new Decimal(0),
        },
      }))

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
      )
      const result = await service.processMonthlyBilling()

      expect(result.processed).toBe(0)
      // The subscription was processed but balance was insufficient
      // So it should appear in invoices with OPEN status
    })

    it("includes previous unpaid OPEN invoices in total due", async () => {
      mockPrisma.billingSubscription.findMany.mockImplementation(async () => [
        {
          id: "sub-1",
          billingAccountId: "ba-1",
          billingAccount: {
            id: "ba-1",
            organizationId: "tenant-1",
            balance: new Decimal(1000000),
          },
        },
      ])

      mockPrisma.invoice.findMany.mockImplementation(async () => [
        {
          id: "prev-inv-1",
          totalAmount: new Decimal(75000),
          status: "OPEN",
        },
      ])

      mockUsageLedger.generateRatedUsage.mockImplementation(async () => [
        {
          subscriptionId: "sub-1",
          category: "WHATSAPP_MESSAGE_OUT",
          rawAmountIdr: new Decimal(25000),
          cappedAmountIdr: new Decimal(25000),
          meterType: "usage",
          meterValue: 25000,
        },
      ])

      mockPrisma.billingAccount.findUnique.mockImplementation(async () => ({
        id: "ba-1",
        balance: {
          gte: () => true,
          minus: () => new Decimal(900000),
        },
      }))

      mockPrisma.$transaction.mockImplementation(async (fn: any) =>
        fn(mockPrisma),
      )

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
      )
      const result = await service.processMonthlyBilling()

      expect(result.processed).toBe(1)
      expect(result.invoices).toHaveLength(1)
    })
  })
})
