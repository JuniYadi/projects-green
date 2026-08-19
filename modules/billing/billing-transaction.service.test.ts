import { describe, expect, it, vi, beforeEach } from "bun:test"
import { Prisma } from "@prisma/client"
import type { PrismaClient } from "@prisma/client"

const mockPrisma = {
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  billingAccount: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  billingAdjustment: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  billingInvoice: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  billingInvoiceLine: {
    create: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma as unknown as PrismaClient,
}))

import { BillingTransactionService } from "./billing-transaction.service"
import type { BalanceMutationInput } from "./billing-transaction.service"

function decimal(value: string) {
  return new Prisma.Decimal(value)
}

function billingAccount(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "ba_1",
    organizationId: "org_1",
    balance: decimal("100.00"),
    currency: "IDR",
    timezone: "UTC",
    status: "ACTIVE",
    metadataJson: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function baseInput(
  overrides: Partial<BalanceMutationInput> = {}
): BalanceMutationInput {
  return {
    organizationId: "org_1",
    amount: decimal("50.00"),
    currency: "IDR",
    source: "TOPUP",
    reason: "Test top-up",
    idempotencyKey: "topup:test:001",
    ...overrides,
  }
}

describe("BillingTransactionService", () => {
  let service: BillingTransactionService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new BillingTransactionService(
      mockPrisma as unknown as PrismaClient
    )

    // Default mock: $transaction invokes the callback with mockPrisma
    mockPrisma.$transaction.mockImplementation(
      async (fn: (...args: unknown[]) => unknown) => {
        return fn(mockPrisma)
      }
    )
  })

  describe("creditBalance", () => {
    it("credits balance with balanceBefore and balanceAfter metadata", async () => {
      const account = billingAccount()
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.billingAccount.update.mockResolvedValue({
        ...account,
        balance: decimal("150.00"),
      })
      mockPrisma.billingAdjustment.create.mockResolvedValue({
        id: "adj_1",
        billingAccountId: "ba_1",
        adjustmentType: "CREDIT",
        amount: decimal("50.00"),
        currency: "IDR",
      })

      const result = await service.creditBalance(baseInput())

      expect(result.balanceBefore.toString()).toBe("100")
      expect(result.balanceAfter.toString()).toBe("150")
      expect(result.alreadyProcessed).toBe(false)

      // Verify metadata in adjustment creation
      const createCall = mockPrisma.billingAdjustment.create.mock.calls[0][0]
      expect(createCall.data.metadataJson.source).toBe("TOPUP")
      // idempotencyKey is stored under _internal to avoid leaking into user-facing API responses
      expect(createCall.data.metadataJson._internal.idempotencyKey).toBe(
        "topup:test:001"
      )
      expect(createCall.data.metadataJson.balanceBefore).toBe("100")
      expect(createCall.data.metadataJson.balanceAfter).toBe("150")
    })

    it("returns alreadyProcessed=true when idempotencyKey exists", async () => {
      const account = billingAccount()
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue({
        id: "adj_existing",
        metadataJson: { _internal: { idempotencyKey: "topup:test:001" } },
      })

      const result = await service.creditBalance(baseInput())

      expect(result.alreadyProcessed).toBe(true)
      expect(result.adjustmentId).toBe("adj_existing")
      // Should not create a new adjustment or update balance
      expect(mockPrisma.billingAccount.update).not.toHaveBeenCalled()
      expect(mockPrisma.billingAdjustment.create).not.toHaveBeenCalled()
    })

    it("rejects currency mismatch", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ currency: "USD" })
      )

      await expect(
        service.creditBalance(baseInput({ currency: "IDR" }))
      ).rejects.toThrow("CURRENCY_MISMATCH")
    })

    it("throws BILLING_ACCOUNT_NOT_FOUND when account missing", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(null)

      await expect(service.creditBalance(baseInput())).rejects.toThrow(
        "BILLING_ACCOUNT_NOT_FOUND"
      )
    })

    it("rejects credit that exceeds max balance", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("999999999.00") })
      )
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)

      await expect(
        service.creditBalance(baseInput({ amount: decimal("1.00") }))
      ).rejects.toThrow("BALANCE_LIMIT_EXCEEDED")
    })
  })

  describe("debitBalance", () => {
    it("debits balance and records metadata", async () => {
      const account = billingAccount()
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.billingAccount.update.mockResolvedValue({
        ...account,
        balance: decimal("40.00"),
      })
      mockPrisma.billingAdjustment.create.mockResolvedValue({
        id: "adj_2",
        billingAccountId: "ba_1",
        adjustmentType: "DEBIT",
        amount: decimal("60.00"),
        currency: "IDR",
      })

      const result = await service.debitBalance(
        baseInput({
          amount: decimal("60.00"),
          source: "APP_HOSTING",
          reason: "PAYG hourly",
        })
      )

      expect(result.balanceBefore.toString()).toBe("100")
      expect(result.balanceAfter.toString()).toBe("40")
      expect(result.alreadyProcessed).toBe(false)
    })
    it("uses the fresh locked account balance for a different idempotency key", async () => {
      const stale = billingAccount({ balance: decimal("100.00") })
      const fresh = billingAccount({ balance: decimal("40.00") })
      mockPrisma.billingAccount.findUnique
        .mockResolvedValueOnce(stale)
        .mockResolvedValueOnce(fresh)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.billingAccount.update.mockResolvedValue({
        ...fresh,
        balance: decimal("30.00"),
      })
      mockPrisma.billingAdjustment.create.mockResolvedValue({
        id: "adj_fresh",
        billingAccountId: "ba_1",
      })

      await service.debitBalance(baseInput({ amount: decimal("10.00") }))

      expect(mockPrisma.billingAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: decimal("30.00") },
        })
      )
    })

    it("rejects insufficient balance", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("50.00") })
      )
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)

      await expect(
        service.debitBalance(baseInput({ amount: decimal("60.00") }))
      ).rejects.toThrow("INSUFFICIENT_BALANCE")
    })

    it("rejects debit that exceeds max balance (negative overflow guard)", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(
        billingAccount({ balance: decimal("0.00") })
      )
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)

      await expect(
        service.debitBalance(baseInput({ amount: decimal("0.01") }))
      ).rejects.toThrow("INSUFFICIENT_BALANCE")
    })
  })

  describe("debitServiceBalance", () => {
    it("creates or reuses current-month service invoice and appends line", async () => {
      const account = billingAccount()
      const now = new Date()
      const periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
      )
      const periodEnd = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999
        )
      )

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.billingAccount.update.mockResolvedValue({
        ...account,
        balance: decimal("40.00"),
      })
      // No existing DRAFT service invoice — will create
      mockPrisma.billingInvoice.findFirst.mockResolvedValue(null)
      mockPrisma.billingInvoice.create.mockResolvedValue({
        id: "inv_svc_1",
        billingAccountId: "ba_1",
        invoiceNumber: "SVC-202606",
        type: "SERVICE",
        status: "DRAFT",
        currency: "IDR",
        periodStart,
        periodEnd,
        subtotalAmount: decimal("0"),
        totalAmount: decimal("0"),
      })
      mockPrisma.billingInvoiceLine.create.mockResolvedValue({
        id: "line_1",
        invoiceId: "inv_svc_1",
        lineType: "USAGE",
        description: "App Hosting PAYG usage",
        quantity: decimal("1"),
        unitPrice: decimal("60.00"),
        amount: decimal("60.00"),
        currency: "IDR",
      })
      mockPrisma.billingInvoice.update.mockResolvedValue({
        id: "inv_svc_1",
        subtotalAmount: decimal("60.00"),
        totalAmount: decimal("60.00"),
      })
      mockPrisma.billingInvoice.count.mockResolvedValue(0)
      mockPrisma.billingAdjustment.create.mockResolvedValue({
        id: "adj_3",
        billingAccountId: "ba_1",
        adjustmentType: "DEBIT",
        amount: decimal("60.00"),
        currency: "IDR",
      })

      await service.debitServiceBalance({
        ...baseInput({
          amount: decimal("60.00"),
          source: "APP_HOSTING",
          reason: "PAYG hourly charge",
        }),
        line: {
          description: "App Hosting PAYG usage",
          quantity: decimal("1"),
          unitPrice: decimal("60.00"),
          lineType: "USAGE",
        },
      })

      expect(mockPrisma.billingInvoice.findFirst).toHaveBeenCalled()
      expect(mockPrisma.billingInvoiceLine.create).toHaveBeenCalled()
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it("locks the account before a credit idempotency lookup", async () => {
      const account = billingAccount()
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue({
        id: "adj_existing",
        invoiceId: null,
        metadataJson: { _internal: { idempotencyKey: "topup:test:001" } },
      })

      await service.creditBalance(baseInput())

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    })
  })

  describe("debitUpfrontSubscription", () => {
    it("creates an instant PAID invoice, invoice line, and debits balance", async () => {
      const account = billingAccount({ balance: decimal("200.00") })
      const _now = new Date("2026-08-19T00:00:00.000Z")
      const periodStart = new Date("2026-08-01T00:00:00.000Z")
      const periodEnd = new Date("2026-08-31T23:59:59.999Z")

      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.billingInvoice.create.mockResolvedValue({
        id: "inv_upfront_1",
        billingAccountId: "ba_1",
        invoiceNumber: "INV-20260819-ABCD",
        type: "SERVICE",
        status: "PAID",
        paymentMethod: "BALANCE",
        currency: "IDR",
        periodStart,
        periodEnd,
        subtotalAmount: decimal("100.00"),
        totalAmount: decimal("100.00"),
      })
      mockPrisma.billingInvoiceLine.create.mockResolvedValue({
        id: "line_upfront_1",
        invoiceId: "inv_upfront_1",
        lineType: "SUBSCRIPTION",
        description: "VPN Pro subscription",
        quantity: decimal("1"),
        unitPrice: decimal("100.00"),
        amount: decimal("100.00"),
        currency: "IDR",
      })
      mockPrisma.billingAccount.update.mockResolvedValue({
        ...account,
        balance: decimal("100.00"),
      })
      mockPrisma.billingInvoice.count.mockResolvedValue(0)
      mockPrisma.billingAdjustment.create.mockResolvedValue({
        id: "adj_upfront_1",
        billingAccountId: "ba_1",
        adjustmentType: "DEBIT",
        amount: decimal("100.00"),
        currency: "IDR",
      })

      const result = await service.debitUpfrontSubscription({
        ...baseInput({
          amount: decimal("100.00"),
          source: "VPN",
          reason: "Subscription order order_1",
          metadata: { orderId: "order_1" },
        }),
        line: {
          description: "VPN Pro subscription",
          quantity: decimal("1"),
          unitPrice: decimal("100.00"),
          lineType: "SUBSCRIPTION",
          periodStart,
          periodEnd,
          category: "vpn",
        },
      })

      expect(mockPrisma.billingInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "SERVICE",
            status: "PAID",
            paymentMethod: "BALANCE",
            metadataJson: expect.objectContaining({
              isUpfront: true,
              orderId: "order_1",
            }),
          }),
        })
      )
      expect(mockPrisma.billingInvoiceLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: "inv_upfront_1",
            lineType: "SUBSCRIPTION",
            description: "VPN Pro subscription",
          }),
        })
      )
      expect(result.invoiceId).toBe("inv_upfront_1")
      expect(result.invoiceLineId).toBe("line_upfront_1")
      expect(result.alreadyProcessed).toBe(false)
    })

    it("records subtotalAmount and discountAmount when provided", async () => {
      const account = billingAccount({ balance: decimal("200.00") })
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue(null)
      mockPrisma.billingInvoice.create.mockResolvedValue({
        id: "inv_upfront_discount",
        invoiceNumber: "INV-20260819-DISC",
        status: "PAID",
      })
      mockPrisma.billingInvoiceLine.create.mockResolvedValue({
        id: "line_discount",
        invoiceId: "inv_upfront_discount",
        amount: decimal("80.00"),
        currency: "IDR",
      })
      mockPrisma.billingAccount.update.mockResolvedValue({
        ...account,
        balance: decimal("120.00"),
      })
      mockPrisma.billingInvoice.count.mockResolvedValue(0)
      mockPrisma.billingAdjustment.create.mockResolvedValue({
        id: "adj_upfront_discount",
        billingAccountId: "ba_1",
        adjustmentType: "DEBIT",
        amount: decimal("80.00"),
        currency: "IDR",
      })

      await service.debitUpfrontSubscription({
        ...baseInput({
          amount: decimal("80.00"),
          source: "VPN",
          reason: "Subscription order order_discount",
          metadata: { orderId: "order_discount" },
        }),
        subtotalAmount: decimal("100.00"),
        discountAmount: decimal("20.00"),
        line: {
          description: "VPN Pro subscription",
          quantity: decimal("1"),
          unitPrice: decimal("100.00"),
          lineType: "SUBSCRIPTION",
          category: "vpn",
        },
      })

      expect(mockPrisma.billingInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalAmount: decimal("100.00"),
            discountAmount: decimal("20.00"),
            totalAmount: decimal("80.00"),
          }),
        })
      )
    })

    it("returns alreadyProcessed if idempotency key is already used", async () => {
      const account = billingAccount({ balance: decimal("200.00") })
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)
      mockPrisma.billingAdjustment.findFirst.mockResolvedValue({
        id: "adj_existing",
        invoiceId: "inv_existing",
        metadataJson: { invoiceLineId: "line_existing" },
      })

      const result = await service.debitUpfrontSubscription({
        ...baseInput({ amount: decimal("100.00"), source: "VPN" }),
        line: {
          description: "VPN Pro subscription",
          quantity: decimal("1"),
          unitPrice: decimal("100.00"),
        },
      })

      expect(result.alreadyProcessed).toBe(true)
      expect(result.invoiceId).toBe("inv_existing")
      expect(result.invoiceLineId).toBe("line_existing")
      expect(mockPrisma.billingInvoice.create).not.toHaveBeenCalled()
    })

    it("throws when billing account not found", async () => {
      mockPrisma.billingAccount.findUnique.mockResolvedValue(null)

      await expect(
        service.debitUpfrontSubscription({
          ...baseInput(),
          line: {
            description: "VPN Pro",
            quantity: decimal("1"),
            unitPrice: decimal("100.00"),
          },
        })
      ).rejects.toThrow("BILLING_ACCOUNT_NOT_FOUND")
    })

    it("throws when currency mismatch", async () => {
      const account = billingAccount({ currency: "USD" })
      mockPrisma.billingAccount.findUnique.mockResolvedValue(account)

      await expect(
        service.debitUpfrontSubscription({
          ...baseInput({ currency: "IDR" }),
          line: {
            description: "VPN Pro",
            quantity: decimal("1"),
            unitPrice: decimal("100.00"),
          },
        })
      ).rejects.toThrow("CURRENCY_MISMATCH")
    })

    it("executes within an external transaction client when provided", async () => {
      const account = billingAccount({ balance: decimal("200.00") })
      const txClient = {
        billingAccount: {
          findUnique: vi.fn().mockResolvedValue(account),
          update: vi.fn().mockResolvedValue({
            ...account,
            balance: decimal("100.00"),
          }),
        },
        billingAdjustment: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "adj_tx_1",
            billingAccountId: "ba_1",
            adjustmentType: "DEBIT",
            amount: decimal("100.00"),
            currency: "IDR",
          }),
        },
        billingInvoice: {
          create: vi.fn().mockResolvedValue({
            id: "inv_tx_1",
            billingAccountId: "ba_1",
            invoiceNumber: "INV-20260819-TX01",
            type: "SERVICE",
            status: "PAID",
            paymentMethod: "BALANCE",
            currency: "IDR",
            periodStart: new Date(),
            periodEnd: new Date(),
            subtotalAmount: decimal("100.00"),
            totalAmount: decimal("100.00"),
          }),
          count: vi.fn().mockResolvedValue(0),
        },
        billingInvoiceLine: {
          create: vi.fn().mockResolvedValue({
            id: "line_tx_1",
            invoiceId: "inv_tx_1",
            lineType: "SUBSCRIPTION",
            description: "VPN Pro subscription",
            quantity: decimal("1"),
            unitPrice: decimal("100.00"),
            amount: decimal("100.00"),
            currency: "IDR",
          }),
        },
        $queryRaw: vi.fn().mockResolvedValue([]),
      }

      const result = await service.debitUpfrontSubscription(
        {
          ...baseInput({ amount: decimal("100.00"), source: "VPN" }),
          line: {
            description: "VPN Pro subscription",
            quantity: decimal("1"),
            unitPrice: decimal("100.00"),
          },
        },
        txClient as unknown as PrismaClient
      )

      expect(txClient.billingInvoice.create).toHaveBeenCalled()
      expect(result.invoiceId).toBe("inv_tx_1")
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })
})
