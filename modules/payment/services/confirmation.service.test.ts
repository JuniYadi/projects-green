import { describe, it, expect, beforeEach, mock } from "bun:test"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockVal = Record<string, any> | null

const mockPaymentConfirmation = {
  findFirst: mock((): Promise<MockVal> => Promise.resolve(null)),
  findUnique: mock((): Promise<MockVal> => Promise.resolve(null)),
  findMany: mock(() => Promise.resolve([])),
  create: mock(() => Promise.resolve({})),
  update: mock(() => Promise.resolve({})),
}

const mockInvoice = {
  findFirst: mock((): Promise<MockVal> => Promise.resolve(null)),
  update: mock(() => Promise.resolve({})),
}

const mockBillingAccount = {
  findUnique: mock(() => Promise.resolve(null)),
}

const mockAuditLog = {
  create: mock(() => Promise.resolve({})),
}

// Mock prisma at leaf level
mock.module("@/lib/prisma", () => ({
  prisma: {
    paymentConfirmation: mockPaymentConfirmation,
    billingInvoice: mockInvoice,
    billingAccount: mockBillingAccount,
    paymentAuditLog: mockAuditLog,
    $transaction: mock(
      (
        fn: (tx: Record<string, unknown>) => Promise<unknown>
      ) => fn({
      paymentConfirmation: mockPaymentConfirmation,
      billingInvoice: mockInvoice,
      paymentAuditLog: mockAuditLog,
    })),
  },
}))

// Mock BillingTransactionService
mock.module("@/modules/billing/billing-transaction.service", () => ({
  BillingTransactionService: mock(() => ({
    creditBalance: mock(() => Promise.resolve({
      billingAccountId: "ba-123",
      adjustmentId: "adj-1",
      alreadyProcessed: false,
    })),
  })),
}))

const { ConfirmationService } = await import("./confirmation.service")

describe("ConfirmationService", () => {
  let service: InstanceType<typeof ConfirmationService>

  function resetMocks() {
    mockPaymentConfirmation.findFirst.mockClear()
    mockPaymentConfirmation.findUnique.mockClear()
    mockPaymentConfirmation.create.mockClear()
    mockPaymentConfirmation.update.mockClear()
    mockInvoice.findFirst.mockClear()
    mockInvoice.update.mockClear()
    mockBillingAccount.findUnique.mockClear()
    mockAuditLog.create.mockClear()
  }

  beforeEach(() => {
    resetMocks()
    mockInvoice.findFirst.mockResolvedValue(null)
    mockPaymentConfirmation.findFirst.mockResolvedValue(null)
    mockPaymentConfirmation.create.mockResolvedValue({ id: "conf-1", status: "PENDING", createdAt: new Date() })
    service = new ConfirmationService()
  })
  describe("approve", () => {
    it("approves and returns invoice details for email dispatch", async () => {
      mockPaymentConfirmation.findUnique.mockResolvedValueOnce({
        id: "conf-123",
        status: "PENDING",
        amount: 50000,
        invoiceId: "inv-123",
        invoice: {
          id: "inv-123",
          invoiceNumber: "TOP-ABC123",
          totalAmount: { toNumber: () => 50000 },
          billingAccount: {
            organizationId: "org-123",
            currency: "IDR",
          },
        },
      })

      mockInvoice.update.mockResolvedValueOnce({ id: "inv-123", status: "PAID" })
      mockAuditLog.create.mockResolvedValueOnce({})

      const result = await service.approve("conf-123", "admin-1")

      expect(result.invoiceId).toBe("inv-123")
      expect(result.invoiceNumber).toBe("TOP-ABC123")
      expect(result.organizationId).toBe("org-123")
      expect(result.totalAmount).toBe(50000)
      expect(mockPaymentConfirmation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "conf-123" },
          data: expect.objectContaining({ status: "APPROVED" }),
        })
      )
    })

    it("throws when confirmation not found", async () => {
      mockPaymentConfirmation.findUnique.mockResolvedValueOnce(null)

      await expect(service.approve("notfound", "admin-1")).rejects.toThrow(
        "Confirmation not found"
      )
    })

    it("throws when already processed", async () => {
      mockPaymentConfirmation.findUnique.mockResolvedValueOnce({
        id: "conf-123",
        status: "APPROVED",
        invoice: { billingAccount: { organizationId: "org-123" } },
      })

      await expect(service.approve("conf-123", "admin-1")).rejects.toThrow(
        "Confirmation already processed"
      )
    })
  })
  describe("create", () => {
    it("throws when pending confirmation already exists", async () => {
      mockInvoice.findFirst.mockResolvedValueOnce({
        id: "inv-1",
        status: "OPEN",
        totalAmount: { toNumber: () => 100000 },
      })
      mockPaymentConfirmation.findFirst.mockResolvedValueOnce({
        id: "conf-existing",
        status: "PENDING",
        invoiceId: "inv-1",
      })

      await expect(
        service.create({
          invoiceId: "inv-1",
          organizationId: "org-1",
          data: {
            bankAccountId: "ba-1",
            amount: 100000,
            paymentDateTime: new Date(),
          },
        })
      ).rejects.toThrow("CONFIRMATION_ALREADY_EXISTS_PENDING")
    })

    it("throws when invoice already paid (APPROVED confirmation)", async () => {
      mockInvoice.findFirst.mockResolvedValueOnce({
        id: "inv-1",
        status: "OPEN",
        totalAmount: { toNumber: () => 100000 },
      })
      mockPaymentConfirmation.findFirst.mockResolvedValueOnce({
        id: "conf-approved",
        status: "APPROVED",
        invoiceId: "inv-1",
      })

      await expect(
        service.create({
          invoiceId: "inv-1",
          organizationId: "org-1",
          data: {
            bankAccountId: "ba-1",
            amount: 100000,
            paymentDateTime: new Date(),
          },
        })
      ).rejects.toThrow("CONFIRMATION_INVOICE_ALREADY_PAID")
    })

    it("creates confirmation when no duplicate exists", async () => {
      mockInvoice.findFirst.mockResolvedValueOnce({
        id: "inv-1",
        status: "OPEN",
        totalAmount: { toNumber: () => 100000 },
      })
      mockPaymentConfirmation.findFirst.mockResolvedValueOnce(null)
      mockPaymentConfirmation.create.mockResolvedValueOnce({
        id: "conf-new",
        status: "PENDING",
        invoiceId: "inv-1",
        bankAccountId: "ba-1",
        amount: 100000,
        paymentDateTime: new Date(),
      })

      const result = await service.create({
        invoiceId: "inv-1",
        organizationId: "org-1",
        data: {
          bankAccountId: "ba-1",
          amount: 100000,
          paymentDateTime: new Date(),
        },
      })

      expect(result.id).toBe("conf-new")
      expect(mockPaymentConfirmation.create).toHaveBeenCalled()
    })
  })
})
