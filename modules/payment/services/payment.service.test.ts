import type { BillingTransactionService } from "@/modules/billing/billing-transaction.service"
import type { InvoiceEmailService } from "@/modules/invoices/email.service"
import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockMemberships = mock(
  async () =>
    [] as Array<{
      userId: string
      role: { slug: string }
    }>
)
const mockCachedOrg = mock(async (_id: string) => ({
  id: "org-123",
  name: "Acme",
  slug: "org-123",
}))
const mockCachedUser = mock(async (_id: string) => ({
  id: "owner-1",
  email: "admin@example.com",
  name: "Admin",
}))
mock.module("@/lib/workos-directory", () => ({
  getCachedOrganization: mockCachedOrg,
  getCachedUser: mockCachedUser,
}))

mock.module("@workos-inc/node", () => ({
  createWorkOS: () => ({
    userManagement: {
      listOrganizationMemberships: mock(async () => ({
        data: [],
        autoPagination: mockMemberships,
      })),
      getUser: mock(async (id: string) => ({ id, email: `${id}@example.com` })),
    },
  }),
}))

const mockPrisma = {
  billingInvoice: {
    create: mock(() =>
      Promise.resolve({
        id: "inv-123",
        invoiceNumber: "TOP-ABC123",
        totalAmount: { toNumber: () => 50000 },
        status: "OPEN",
        currency: "IDR",
        paymentMethod: "VA",
        dueDate: new Date("2026-06-10"),
        type: "TOP_UP",
      })
    ),
    update: mock(() => Promise.resolve({})),
    findFirst: mock(() => Promise.resolve(null)),
    findUnique: mock(() => Promise.resolve(null)),
    findMany: mock(() => Promise.resolve([])),
  },
  billingAccount: {
    findUnique: mock(() =>
      Promise.resolve({
        id: "ba-123",
        organizationId: "org-123",
        balance: { toNumber: () => 100000 },
        currency: "IDR",
      })
    ),
    create: mock(() =>
      Promise.resolve({
        id: "ba-123",
        organizationId: "org-123",
        currency: "IDR",
      })
    ),
    update: mock(() => Promise.resolve({})),
  },
  billingAdjustment: {
    create: mock(() => Promise.resolve({})),
  },
  billingOrder: {
    findMany: mock(() => Promise.resolve([])),
    update: mock(() => Promise.resolve({})),
  },
  paymentCurrency: {
    findUnique: mock(() => Promise.resolve(null)),
  },
  billingInvoicePaymentAllocation: {
    create: mock(() => Promise.resolve({})),
  },
}
const mockFulfillOrder = mock(() => Promise.resolve())

mock.module("@/modules/billing/orders/order.service", () => ({
  BillingOrderService: class {
    fulfillOrder = mockFulfillOrder
  },
}))

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// Mock BillingTransactionService to verify it's called correctly
const mockBillingTransactions = {
  creditBalance: mock(() =>
    Promise.resolve({
      billingAccountId: "ba-123",
      adjustmentId: "adj-1",
      balanceBefore: { toString: () => "100000" },
      balanceAfter: { toString: () => "150000" },
      amount: { toString: () => "50000" },
      currency: "IDR",
      alreadyProcessed: false,
    })
  ),
  debitBalance: mock(() =>
    Promise.resolve({
      billingAccountId: "ba-123",
      adjustmentId: "adj-2",
      balanceBefore: { toString: () => "100000" },
      balanceAfter: { toString: () => "50000" },
      amount: { toString: () => "50000" },
      currency: "IDR",
      alreadyProcessed: false,
    })
  ),
}

// Mock email service to prevent actual email sending during tests
const mockEmailService = {
  sendInvoiceCreated: mock(() => Promise.resolve()),
  sendPaymentReminder: mock(() => Promise.resolve()),
  sendInvoicePaid: mock(() => Promise.resolve()),
  sendInvoiceOverdue: mock(() => Promise.resolve()),
  sendInvoiceCancelled: mock(() => Promise.resolve()),
  sendTopupReceivedAdminNotice: mock(() => Promise.resolve()),
}

const { PaymentService } = await import("./payment.service")

describe("PaymentService", () => {
  let service: InstanceType<typeof PaymentService>

  function resetMocks() {
    mockPrisma.billingInvoice.create.mockReset()
    mockPrisma.billingOrder.findMany.mockReset()
    mockPrisma.billingOrder.update.mockReset()
    mockFulfillOrder.mockReset()
    mockPrisma.billingInvoice.update.mockReset()
    mockPrisma.billingInvoice.findFirst.mockReset()
    mockPrisma.billingInvoice.findUnique.mockReset()
    mockPrisma.billingInvoice.findMany.mockReset()
    mockPrisma.billingAccount.findUnique.mockReset()
    mockPrisma.billingAccount.create.mockReset()
    mockPrisma.billingAccount.update.mockReset()
    mockPrisma.billingAdjustment.create.mockReset()
    mockBillingTransactions.creditBalance.mockReset()
    mockBillingTransactions.debitBalance.mockReset()

    // Restore default implementations
    mockPrisma.billingInvoice.create.mockImplementation(() =>
      Promise.resolve({
        id: "inv-123",
        invoiceNumber: "TOP-ABC123",
        totalAmount: { toNumber: () => 50000 },
        status: "OPEN",
        currency: "IDR",
        paymentMethod: "VA",
        dueDate: new Date("2026-06-10"),
        type: "TOP_UP",
      })
    )
    mockPrisma.billingInvoice.update.mockImplementation(() =>
      Promise.resolve({
        id: "inv-123",
        invoiceNumber: "TOP-ABC123",
        totalAmount: { toNumber: () => 50000 },
        currency: "IDR",
        status: "PAID",
        periodStart: new Date(),
        periodEnd: new Date(),
      })
    )
    mockPrisma.billingInvoice.findFirst.mockImplementation(() =>
      Promise.resolve(null)
    )
    mockPrisma.billingInvoice.findMany.mockImplementation(() =>
      Promise.resolve([])
    )
    mockPrisma.billingInvoice.findUnique.mockImplementation(() =>
      Promise.resolve({
        type: "TOP_UP",
        createdByEmail: "payer@example.com",
        paymentMethod: "VA",
        paidAt: new Date("2026-09-26T00:00:00.000Z"),
      })
    )
    mockMemberships.mockClear()
    mockMemberships.mockImplementation(async () => [])
    mockCachedOrg.mockClear()
    mockCachedOrg.mockImplementation(async () => ({
      id: "org-123",
      name: "Acme",
      slug: "org-123",
    }))
    mockCachedUser.mockClear()
    mockCachedUser.mockImplementation(async () => ({
      id: "owner-1",
      email: "admin@example.com",
      name: "Admin",
    }))
    for (const fn of Object.values(mockEmailService)) fn.mockClear()
    mockPrisma.billingOrder.findMany.mockImplementation(() =>
      Promise.resolve([])
    )
    mockPrisma.billingOrder.update.mockImplementation(() => Promise.resolve({}))
    mockFulfillOrder.mockImplementation(() => Promise.resolve())
    mockPrisma.billingAccount.findUnique.mockImplementation(() =>
      Promise.resolve({
        id: "ba-123",
        organizationId: "org-123",
        balance: { toNumber: () => 100000 },
        currency: "IDR",
      })
    )
    mockPrisma.billingAccount.create.mockImplementation(() =>
      Promise.resolve({
        id: "ba-123",
        organizationId: "org-123",
        currency: "IDR",
      })
    )
    mockPrisma.billingAccount.update.mockImplementation(() =>
      Promise.resolve({})
    )
    mockPrisma.billingAdjustment.create.mockImplementation(() =>
      Promise.resolve({})
    )
    mockBillingTransactions.creditBalance.mockImplementation(() =>
      Promise.resolve({
        billingAccountId: "ba-123",
        adjustmentId: "adj-1",
        balanceBefore: { toString: () => "100000" },
        balanceAfter: { toString: () => "150000" },
        amount: { toString: () => "50000" },
        currency: "IDR",
        alreadyProcessed: false,
      })
    )
    mockBillingTransactions.debitBalance.mockImplementation(() =>
      Promise.resolve({
        billingAccountId: "ba-123",
        adjustmentId: "adj-2",
        balanceBefore: { toString: () => "100000" },
        balanceAfter: { toString: () => "50000" },
        amount: { toString: () => "50000" },
        currency: "IDR",
        alreadyProcessed: false,
      })
    )
  }

  beforeEach(() => {
    service = new PaymentService(
      mockBillingTransactions as unknown as BillingTransactionService,
      mockEmailService as unknown as InvoiceEmailService
    )
    resetMocks()
  })

  describe("createTopupInvoice", () => {
    it("should create invoice with correct fields", async () => {
      const invoice = await service.createTopupInvoice({
        organizationId: "org-123",
        amount: 5000,
        paymentMethod: "VA",
        gatewayId: "gw-123",
      })

      expect(invoice.id).toBe("inv-123")
      expect(invoice.invoiceNumber).toMatch(/^TOP-/)
      expect(mockPrisma.billingInvoice.create).toHaveBeenCalledTimes(1)
    })

    it("stores the actor separately from gateway metadata", async () => {
      await service.createTopupInvoice({
        organizationId: "org-123",
        amount: 5000,
        actorUserId: "user-1",
        actorEmail: "payer@example.com",
      })
      expect(mockPrisma.billingInvoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          createdByUserId: "user-1",
          createdByEmail: "payer@example.com",
        }),
      })
    })

    it("should throw error for amount below minimum", async () => {
      await expect(
        service.createTopupInvoice({
          organizationId: "org-123",
          amount: 1,
        })
      ).rejects.toThrow("Minimum top-up amount is 10 IDR")
    })

    it("should throw error for amount above maximum", async () => {
      await expect(
        service.createTopupInvoice({
          organizationId: "org-123",
          amount: 20000,
        })
      ).rejects.toThrow("Maximum top-up amount is 10000 IDR")
    })

    it("uses PaymentCurrency bounds when a row exists (IDR)", async () => {
      ;(
        mockPrisma.paymentCurrency.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        code: "IDR",
        minTopup: { toNumber: () => 250_000 },
        maxTopup: { toNumber: () => 250_000_000 },
      })

      const invoice = await service.createTopupInvoice({
        organizationId: "org-123",
        amount: 180_000_000,
      })

      expect(invoice.id).toBe("inv-123")
      expect(mockPrisma.billingInvoice.create).toHaveBeenCalledTimes(1)
    })

    it("rejects below the IDR PaymentCurrency minimum", async () => {
      ;(
        mockPrisma.paymentCurrency.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        code: "IDR",
        minTopup: { toNumber: () => 250_000 },
        maxTopup: { toNumber: () => 250_000_000 },
      })

      await expect(
        service.createTopupInvoice({
          organizationId: "org-123",
          amount: 180_000,
        })
      ).rejects.toThrow("Minimum top-up amount is 250000 IDR")
    })

    it("should create billing account if not exists", async () => {
      ;(
        mockPrisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce(null)

      await service.createTopupInvoice({
        organizationId: "org-new",
        amount: 5000,
      })

      expect(mockPrisma.billingAccount.create).toHaveBeenCalledTimes(1)
    })

    it("uses account currency for top-up invoice", async () => {
      ;(
        mockPrisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "ba-usd",
        organizationId: "org-usd",
        currency: "USD",
      })
      mockPrisma.billingInvoice.create.mockResolvedValueOnce({
        id: "inv-usd",
        invoiceNumber: "TOP-USD001",
        currency: "USD",
        totalAmount: { toNumber: () => 50000 },
        status: "OPEN" as string,
        paymentMethod: null as unknown as string,
        dueDate: new Date(),
        type: "TOP_UP",
      })

      const invoice = await service.createTopupInvoice({
        organizationId: "org-usd",
        amount: 5000,
      })

      expect(invoice.currency).toBe("USD")
    })
  })

  describe("getInvoicesForOrganization", () => {
    it("should return invoices for organization", async () => {
      const invoices = await service.getInvoicesForOrganization("org-123")

      expect(Array.isArray(invoices)).toBe(true)
      expect(mockPrisma.billingInvoice.findMany).toHaveBeenCalledTimes(1)
    })
  })

  describe("markInvoiceAsPaid", () => {
    it("should update invoice status to PAID", async () => {
      await service.markInvoiceAsPaid("inv-123")

      expect(mockPrisma.billingInvoice.update).toHaveBeenCalledWith({
        where: { id: "inv-123" },
        data: { status: "PAID", paidAt: expect.any(Date) },
      })
    })
    it("marks a linked product order charged and fulfills it once", async () => {
      mockPrisma.billingOrder.findMany.mockResolvedValueOnce([
        { id: "order-1", status: "PENDING" } as never,
      ])

      await service.markInvoiceAsPaid("invoice-1")

      expect(mockPrisma.billingOrder.update).toHaveBeenCalledWith({
        where: { id: "order-1" },
        data: expect.objectContaining({ status: "CHARGED" }),
      })
      expect(mockFulfillOrder).toHaveBeenCalledTimes(1)
      expect(mockFulfillOrder).toHaveBeenCalledWith("order-1")
    })
  })

  describe("creditBalance", () => {
    it("should credit via BillingTransactionService with idempotencyKey", async () => {
      await service.creditBalance("org-123", 50000, "inv-123")

      expect(mockBillingTransactions.creditBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-123",
          amount: expect.objectContaining({}),
          currency: "IDR",
          source: "TOPUP",
          idempotencyKey: "topup:inv-123",
          invoiceId: "inv-123",
        })
      )
    })

    it("should throw error when billing account not found", async () => {
      ;(
        mockPrisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce(null)

      await expect(
        service.creditBalance("org-notfound", 50000, "REF001")
      ).rejects.toThrow("Billing account not found")
    })
  })

  describe("payWithBalance", () => {
    it("should debit via BillingTransactionService and mark invoice as paid", async () => {
      ;(
        mockPrisma.billingInvoice.findFirst as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "inv-123",
        status: "OPEN",
        totalAmount: { toNumber: () => 50000 },
        invoiceNumber: "TOP-ABC123",
        currency: "IDR",
      })

      await service.payWithBalance("inv-123", "org-123")

      expect(mockBillingTransactions.debitBalance).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-123",
          amount: expect.objectContaining({}),
          currency: "IDR",
          source: "ADJUSTMENT",
          idempotencyKey: "pay:inv-123",
          invoiceId: "inv-123",
        })
      )
      expect(mockPrisma.billingInvoice.update).toHaveBeenCalledWith({
        where: { id: "inv-123" },
        data: expect.objectContaining({ status: "PAID" }),
      })
    })

    it("should throw error when invoice not found", async () => {
      ;(
        mockPrisma.billingInvoice.findFirst as ReturnType<typeof mock>
      ).mockResolvedValueOnce(null)

      await expect(
        service.payWithBalance("inv-notfound", "org-123")
      ).rejects.toThrow("Invoice not found or not open")
    })

    it("should throw error when insufficient balance", async () => {
      ;(
        mockPrisma.billingInvoice.findFirst as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "inv-123",
        status: "OPEN",
        totalAmount: { toNumber: () => 200000 },
        invoiceNumber: "TOP-ABC123",
        currency: "IDR",
      })
      ;(
        mockPrisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "ba-123",
        organizationId: "org-123",
        balance: { toNumber: () => 50000 },
      })

      await expect(
        service.payWithBalance("inv-123", "org-123")
      ).rejects.toThrow("Insufficient balance")
    })
  })

  describe("sendInvoicePaidEmail", () => {
    it("sends email to billing contacts when present", async () => {
      ;(
        mockPrisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "ba-123",
        organizationId: "org-123",
        currency: "IDR",
        contacts: [
          {
            id: "c1",
            email: "billing@example.com",
            isActive: true,
            notifyOnInvoice: true,
          },
        ],
      })

      await service.sendInvoicePaidEmail(
        {
          id: "inv-123",
          invoiceNumber: "TOP-ABC123",
          totalAmount: { toNumber: () => 50000 },
          currency: "IDR",
          status: "paid",
          issuedAt: new Date(),
          dueDate: new Date(),
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        "org-123"
      )

      expect(mockEmailService.sendInvoicePaid).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: "TOP-ABC123",
          status: "paid",
        }),
        "billing@example.com",
        "org-123",
        { billedToEmail: "billing@example.com", organizationName: "Acme" }
      )
      expect(mockEmailService.sendInvoicePaid).toHaveBeenCalledWith(
        expect.anything(),
        "payer@example.com",
        "org-123",
        { billedToEmail: "billing@example.com", organizationName: "Acme" }
      )
      expect(
        mockEmailService.sendTopupReceivedAdminNotice
      ).not.toHaveBeenCalled()
    })

    it("notifies org admin after payment without sending them an invoice", async () => {
      mockMemberships.mockImplementation(async () => [
        {
          userId: "owner-1",
          role: { slug: "user_owner" },
        },
      ])
      mockPrisma.billingAccount.findUnique.mockResolvedValueOnce({
        id: "ba-123",
        contacts: [{ email: "billing@example.com" }],
      } as never)
      await service.sendInvoicePaidEmail(
        {
          id: "inv-123",
          invoiceNumber: "TOP-ABC123",
          totalAmount: { toNumber: () => 50000 },
          currency: "IDR",
          status: "PAID",
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        "org-123"
      )
      expect(
        mockEmailService.sendInvoicePaid.mock.calls.map((call) => call[1])
      ).toEqual(["billing@example.com", "payer@example.com"])
      expect(
        mockEmailService.sendTopupReceivedAdminNotice
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          actorEmail: "payer@example.com",
          organizationName: "Acme",
          amount: 50000,
          paymentMethod: "VA",
        }),
        "admin@example.com"
      )
    })

    it("does not notify the actor twice when they are the org admin", async () => {
      mockMemberships.mockImplementation(async () => [
        {
          userId: "owner-1",
          role: { slug: "user_admin" },
        },
      ])
      mockCachedUser.mockImplementation(async () => ({
        id: "owner-1",
        email: "payer@example.com",
        name: "Admin",
      }))
      await service.sendInvoicePaidEmail(
        {
          id: "inv-123",
          invoiceNumber: "TOP-ABC123",
          totalAmount: { toNumber: () => 50000 },
          currency: "IDR",
          status: "PAID",
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        "org-123"
      )
      expect(
        mockEmailService.sendTopupReceivedAdminNotice
      ).not.toHaveBeenCalled()
    })

    it("keeps a contact admin on the invoice and sends their notice too", async () => {
      mockMemberships.mockImplementation(async () => [
        {
          userId: "owner-1",
          role: { slug: "user_owner" },
        },
      ])
      mockPrisma.billingAccount.findUnique.mockResolvedValueOnce({
        id: "ba-123",
        contacts: [{ email: "ADMIN@example.com" }],
      } as never)
      await service.sendInvoicePaidEmail(
        {
          id: "inv-123",
          invoiceNumber: "TOP-ABC123",
          totalAmount: { toNumber: () => 50000 },
          currency: "IDR",
          status: "PAID",
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        "org-123"
      )
      expect(
        mockEmailService.sendInvoicePaid.mock.calls.map((call) => call[1])
      ).toEqual(["ADMIN@example.com", "payer@example.com"])
      expect(
        mockEmailService.sendTopupReceivedAdminNotice
      ).toHaveBeenCalledTimes(1)
    })

    it("does not send a top-up notice for other paid invoice types", async () => {
      mockPrisma.billingInvoice.findUnique.mockResolvedValueOnce({
        type: "SERVICE",
        createdByEmail: null,
      } as never)
      mockMemberships.mockImplementation(async () => [
        {
          userId: "owner-1",
          role: { slug: "user_owner" },
        },
      ])
      await service.sendInvoicePaidEmail(
        {
          id: "inv-123",
          invoiceNumber: "INV-123",
          totalAmount: { toNumber: () => 50000 },
          currency: "IDR",
          status: "PAID",
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        "org-123"
      )
      expect(mockEmailService.sendInvoicePaid).toHaveBeenCalledWith(
        expect.anything(),
        "admin@example.com",
        "org-123",
        expect.anything()
      )
      expect(
        mockEmailService.sendTopupReceivedAdminNotice
      ).not.toHaveBeenCalled()
    })

    it("uses admin only as invoice fallback when there is no contact or actor", async () => {
      mockPrisma.billingInvoice.findUnique.mockResolvedValueOnce({
        type: "TOP_UP",
        createdByEmail: null,
      } as never)
      mockMemberships.mockImplementation(async () => [
        {
          userId: "owner-1",
          role: { slug: "user_owner" },
        },
      ])
      await service.sendInvoicePaidEmail(
        {
          id: "inv-123",
          invoiceNumber: "TOP-ABC123",
          totalAmount: { toNumber: () => 50000 },
          currency: "IDR",
          status: "PAID",
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        "org-123"
      )
      expect(mockEmailService.sendInvoicePaid).toHaveBeenCalledWith(
        expect.anything(),
        "admin@example.com",
        "org-123",
        { billedToEmail: undefined, organizationName: "Acme" }
      )
    })

    it("does not throw when WorkOS fails (fire-and-forget resilience)", async () => {
      // No contacts — falls through to WorkOS which will fail
      ;(
        mockPrisma.billingAccount.findUnique as ReturnType<typeof mock>
      ).mockResolvedValueOnce({
        id: "ba-123",
        organizationId: "org-missing",
        currency: "IDR",
        contacts: [],
      })

      await expect(
        service.sendInvoicePaidEmail(
          {
            id: "inv-456",
            invoiceNumber: "TOP-456",
            totalAmount: { toNumber: () => 25000 },
            currency: "IDR",
            status: "paid",
            issuedAt: new Date(),
            dueDate: new Date(),
            periodStart: new Date(),
            periodEnd: new Date(),
          },
          "org-missing"
        )
      ).resolves.toBeUndefined()
    })
  })

  it("sends newly created top-up invoice to the actor, not the org admin", async () => {
    mockMemberships.mockImplementation(async () => [
      {
        userId: "owner-1",
        role: { slug: "user_owner" },
      },
    ])
    mockPrisma.billingAccount.findUnique.mockResolvedValueOnce({
      id: "ba-123",
      contacts: [{ email: "billing@example.com" }],
    } as never)
    await service["sendTopupInvoiceEmail"](
      {
        id: "inv-123",
        invoiceNumber: "TOP-ABC123",
        totalAmount: { toNumber: () => 50000 },
        currency: "IDR",
        status: "OPEN",
        periodStart: new Date(),
        periodEnd: new Date(),
      },
      "org-123"
    )
    expect(
      mockEmailService.sendInvoiceCreated.mock.calls.map((call) => call[1])
    ).toEqual(["billing@example.com", "payer@example.com"])
    expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledWith(
      expect.anything(),
      "payer@example.com",
      "org-123",
      { organizationName: "Acme", billedToEmail: "billing@example.com" }
    )
  })
})
