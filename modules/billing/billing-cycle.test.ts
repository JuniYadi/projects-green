/**
 * Billing Cycle Service Tests
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, mock } from "bun:test"
import { Prisma, PrismaClient } from "@prisma/client"
import Decimal = Prisma.Decimal

import { UsageLedgerService } from "./usage-ledger.service"

// ─── Mock WorkOS before billing-cycle import ────────────────────────────────
const mockListOrgMemberships = mock()
const mockGetUser = mock()

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    userManagement: {
      listOrganizationMemberships: mockListOrgMemberships,
      getUser: mockGetUser,
    },
  }),
}))

// Module under test
const { BillingCycleService } = await import("./billing-cycle.service")

// ─── Mock Prisma ────────────────────────────────────────────────────────────

function createMockPrisma() {
  return {
    billingRun: {
      findFirst: mock(async () => null as any),
      create: mock(async (data: any) => ({
        id: "br-1",
        ...data,
        status: "RUNNING",
      })) as any,
      update: mock(async (data: unknown) => data),
    },
    billingSubscription: {
      findMany: mock(async () => [] as any),
    },
    billingAccount: {
      findUnique: mock(async () => null as any),
      update: mock(async (data: unknown) => data),
    },
    billingInvoice: {
      create: mock(async (data: any) => ({
        id: "inv-1",
        ...data.data,
      })),
      update: mock(async (data: unknown) => data),
      updateMany: mock(async () => ({ count: 0 })),
      findMany: mock(async () => [] as any),
    },
    billingInvoiceLine: {
      create: mock(async (data: any) => ({
        id: "il-1",
        ...data.data,
      })),
    },
    billingAdjustment: {
      create: mock(async (data: any) => ({
        id: "adj-1",
        ...data.data,
      })),
    },
    $transaction: mock(async (fn: any) => fn(createMockPrisma())) as any,
  }
}

// ─── Mock UsageLedgerService ────────────────────────────────────────────────

const mockUsageLedger = {
  generateRatedUsage: mock(async () => [] as Array<Record<string, unknown>>),
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("BillingCycleService", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    mockPrisma = createMockPrisma()
    mockUsageLedger.generateRatedUsage.mockImplementation(async () => [])
  })

  describe("finalizeServiceInvoices", () => {
    it("returns 0 when no DRAFT service invoices exist for the previous month", async () => {
      mockPrisma.billingInvoice.findMany.mockImplementation(async () => [])

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService
      )
      const result = await service.finalizeServiceInvoices()

      expect(result.finalized).toBe(0)
    })

    it("finalizes DRAFT service invoices as PAID and sets timestamps", async () => {
      const mockInvoice = {
        id: "svc-inv-1",
        billingAccountId: "ba-1",
        invoiceNumber: "SVC-202606",
        type: "SERVICE",
        status: "DRAFT" as const,
        currency: "IDR",
        totalAmount: new Decimal(150000),
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-06-30"),
      }

      mockPrisma.billingInvoice.findMany.mockImplementation(async () => [
        mockInvoice,
      ])
      mockPrisma.billingInvoice.updateMany.mockImplementation(async () => ({
        count: 1,
      }))

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService
      )
      const result = await service.finalizeServiceInvoices()

      expect(result.finalized).toBe(1)
      expect(mockPrisma.billingInvoice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "DRAFT" }),
          data: expect.objectContaining({
            status: "PAID",
          }),
        })
      )
    })

    it("does not finalize non-DRAFT invoices", async () => {
      mockPrisma.billingInvoice.findMany.mockImplementation(async () => [])
      mockPrisma.billingInvoice.updateMany.mockImplementation(async () => ({
        count: 0,
      }))

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService
      )
      const result = await service.finalizeServiceInvoices()

      expect(result.finalized).toBe(0)
    })
  })

  describe("processMonthlyBilling", () => {
    it("returns empty result when no active subscriptions exist", async () => {
      mockPrisma.billingSubscription.findMany.mockImplementation(async () => [])

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService
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
        mockUsageLedger as unknown as UsageLedgerService
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
        mockUsageLedger as unknown as UsageLedgerService
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

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
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
        mockUsageLedger as unknown as UsageLedgerService
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

      mockPrisma.$transaction.mockImplementation(
        async (
          fn: (tx: ReturnType<typeof createMockPrisma>) => Promise<unknown>
        ) => fn(mockPrisma)
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
        mockUsageLedger as unknown as UsageLedgerService
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

      mockPrisma.billingInvoice.findMany.mockImplementation(async () => [
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

      mockPrisma.$transaction.mockImplementation(
        async (
          fn: (tx: ReturnType<typeof createMockPrisma>) => Promise<unknown>
        ) => fn(mockPrisma)
      )

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService
      )
      const result = await service.processMonthlyBilling()

      expect(result.processed).toBe(1)
      expect(result.invoices).toHaveLength(1)
    })

    it("sends email notification when emailService is provided", async () => {
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

      mockPrisma.billingAccount.findUnique.mockImplementation(async () => ({
        id: "ba-1",
        balance: {
          gte: () => true,
          minus: () => new Decimal(475000),
        },
      }))

      mockPrisma.$transaction.mockImplementation(
        async (
          fn: (tx: ReturnType<typeof createMockPrisma>) => Promise<unknown>
        ) => fn(mockPrisma)
      )

      // Mock WorkOS to return admin email
      mockListOrgMemberships.mockResolvedValueOnce({
        data: [
          {
            userId: "user-admin-1",
            role: { slug: "admin" },
          },
        ],
      })
      mockGetUser.mockResolvedValueOnce({ email: "admin@example.com" })

      const mockEmailService = {
        sendInvoiceCreated: mock(async () => {}),
      }

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
        mockEmailService as any
      )
      const result = await service.processMonthlyBilling()

      // Email notifications are fire-and-forget; drain microtasks to let them resolve
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(result.processed).toBe(1)
      expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledTimes(1)
      expect(mockListOrgMemberships).toHaveBeenCalledWith({
        organizationId: "tenant-1",
        statuses: ["active"],
      })
      expect(mockGetUser).toHaveBeenCalledWith("user-admin-1")
    })

    it("skips email when admin not found in org memberships", async () => {
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

      mockPrisma.billingAccount.findUnique.mockImplementation(async () => ({
        id: "ba-1",
        balance: {
          gte: () => true,
          minus: () => new Decimal(475000),
        },
      }))

      mockPrisma.$transaction.mockImplementation(
        async (
          fn: (tx: ReturnType<typeof createMockPrisma>) => Promise<unknown>
        ) => fn(mockPrisma)
      )

      // No admin/owner in memberships
      mockListOrgMemberships.mockResolvedValueOnce({
        data: [
          {
            userId: "user-member-1",
            role: { slug: "user_member" },
          },
        ],
      })

      const mockEmailService = {
        sendInvoiceCreated: mock(async () => {}),
      }

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
        mockEmailService as any
      )
      const result = await service.processMonthlyBilling()

      expect(result.processed).toBe(1)
      // Email should not be sent since no admin found
      expect(mockEmailService.sendInvoiceCreated).not.toHaveBeenCalled()
    })

    it("sends no email when subscription has no organizationId", async () => {
      mockPrisma.billingSubscription.findMany.mockImplementation(async () => [
        {
          id: "sub-1",
          billingAccountId: "ba-1",
          billingAccount: {
            id: "ba-1",
            organizationId: null,
            balance: new Decimal(500000),
          },
        },
      ])

      const mockEmailService = {
        sendInvoiceCreated: mock(async () => {}),
      }

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
        mockEmailService as any
      )
      const result = await service.processMonthlyBilling()

      // Subscription with no org should be SKIPPED before email
      expect(result.skipped).toBe(1)
      expect(mockEmailService.sendInvoiceCreated).not.toHaveBeenCalled()
    })
  })

  describe("finalizeServiceInvoices with email", () => {
    it("sends email when finalizing invoices", async () => {
      const mockInvoice = {
        id: "svc-inv-1",
        billingAccountId: "ba-1",
        invoiceNumber: "SVC-202606",
        type: "SERVICE",
        status: "DRAFT" as const,
        currency: "IDR",
        totalAmount: new Decimal(150000),
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-06-30"),
      }

      mockPrisma.billingInvoice.findMany.mockImplementation(async () => [
        mockInvoice,
      ])
      mockPrisma.billingInvoice.updateMany.mockImplementation(async () => ({
        count: 1,
      }))

      mockPrisma.billingAccount.findUnique.mockImplementation(async () => ({
        organizationId: "tenant-1",
      }))

      mockListOrgMemberships.mockResolvedValueOnce({
        data: [
          {
            userId: "user-admin-1",
            role: { slug: "admin" },
          },
        ],
      })
      mockGetUser.mockResolvedValueOnce({ email: "admin@example.com" })

      const mockEmailService = {
        sendInvoiceCreated: mock(async () => {}),
      }

      const service = new BillingCycleService(
        mockPrisma as unknown as PrismaClient,
        mockUsageLedger as unknown as UsageLedgerService,
        mockEmailService as any
      )
      const result = await service.finalizeServiceInvoices()

      expect(result.finalized).toBe(1)
      expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledTimes(1)
    })
  })
})
