import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test"
import type { BillingTransactionService } from "@/modules/billing/billing-transaction.service"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockVal = Record<string, any> | null

const mockPaymentConfirmation = {
  findFirst: mock((): Promise<MockVal> => Promise.resolve(null)),
  findUnique: mock((): Promise<MockVal> => Promise.resolve(null)),
  findMany: mock(() => Promise.resolve([] as Array<Record<string, unknown>>)),
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
const mockSendPaymentConfirmationSubmitted = mock(async () => {})
const mockResolveInvoiceEmailRecipients = mock(() =>
  Promise.resolve([] as Array<{ email: string }>)
)

mock.module("@/modules/invoices/email.service", () => ({
  createInvoiceEmailService: () => ({
    sendPaymentConfirmationSubmitted: mockSendPaymentConfirmationSubmitted,
  }),
}))

mock.module("@/modules/billing/email-recipients", () => ({
  resolveInvoiceEmailRecipients: mockResolveInvoiceEmailRecipients,
}))

const mockSettleProductOrdersForInvoice = mock(async () => {})
const mockEmitBillingAudit = mock(() => {})

mock.module("@/modules/billing/orders/payment-settlement", () => ({
  settleProductOrdersForInvoice: mockSettleProductOrdersForInvoice,
}))

mock.module("@/modules/billing/audit/audit.service", () => ({
  emitBillingAudit: mockEmitBillingAudit,
}))

// Mock prisma at leaf level
mock.module("@/lib/prisma", () => ({
  prisma: {
    paymentConfirmation: mockPaymentConfirmation,
    billingInvoice: mockInvoice,
    billingAccount: mockBillingAccount,
    paymentAuditLog: mockAuditLog,
    $transaction: mock(
      (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn({
          paymentConfirmation: mockPaymentConfirmation,
          billingInvoice: mockInvoice,
          paymentAuditLog: mockAuditLog,
        })
    ),
  },
}))

// Mock BillingTransactionService
mock.module("@/modules/billing/billing-transaction.service", () => ({
  BillingTransactionService: mock(() => ({
    creditBalance: mock(() =>
      Promise.resolve({
        billingAccountId: "ba-123",
        adjustmentId: "adj-1",
        alreadyProcessed: false,
      })
    ),
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
    mockPaymentConfirmation.findMany.mockClear()
    mockInvoice.findFirst.mockClear()
    mockInvoice.update.mockClear()
    mockBillingAccount.findUnique.mockClear()
    mockAuditLog.create.mockClear()
    mockSendPaymentConfirmationSubmitted.mockClear()
    mockResolveInvoiceEmailRecipients.mockClear()
    mockSettleProductOrdersForInvoice.mockClear()
    mockEmitBillingAudit.mockClear()
  }

  beforeEach(() => {
    mockResolveInvoiceEmailRecipients.mockResolvedValue([])
    mockSendPaymentConfirmationSubmitted.mockResolvedValue(undefined)
    resetMocks()
    mockInvoice.findFirst.mockResolvedValue(null)
    mockPaymentConfirmation.findFirst.mockResolvedValue(null)
    mockPaymentConfirmation.create.mockResolvedValue({
      id: "conf-1",
      status: "PENDING",
      createdAt: new Date(),
    })
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

      mockInvoice.update.mockResolvedValueOnce({
        id: "inv-123",
        status: "PAID",
      })
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

    it("approves confirmation without duplicate credit if invoice is already PAID", async () => {
      mockPaymentConfirmation.findUnique.mockResolvedValueOnce({
        id: "conf-123",
        status: "PENDING",
        amount: 50000,
        invoiceId: "inv-123",
        invoice: {
          id: "inv-123",
          invoiceNumber: "TOP-ABC123",
          status: "PAID",
          totalAmount: { toNumber: () => 50000 },
          billingAccount: {
            organizationId: "org-123",
            currency: "IDR",
          },
        },
      })

      const mockCreditBalance = mock(() => Promise.resolve({}))
      const customService = new ConfirmationService({
        creditBalance: mockCreditBalance,
      } as unknown as BillingTransactionService)

      const result = await customService.approve("conf-123", "admin-1")

      expect(result.invoiceId).toBe("inv-123")
      expect(mockCreditBalance).not.toHaveBeenCalled()
      expect(mockInvoice.update).not.toHaveBeenCalled()
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

    it("throws when invoice billing account is missing", async () => {
      mockPaymentConfirmation.findUnique.mockResolvedValueOnce({
        id: "conf-123",
        status: "PENDING",
        amount: 50000,
        invoiceId: "inv-123",
        invoice: { billingAccount: null },
      })

      await expect(service.approve("conf-123", "admin-1")).rejects.toThrow(
        "Billing account not found for invoice"
      )
    })
  })
  describe("create", () => {
    it("throws when invoice is not found or not open", async () => {
      mockInvoice.findFirst.mockResolvedValueOnce(null)

      await expect(
        service.create({
          invoiceId: "inv-missing",
          organizationId: "org-1",
          data: {
            bankAccountId: "ba-1",
            amount: 100000,
            paymentDateTime: new Date(),
          },
        })
      ).rejects.toThrow("Invoice not found or not open")
    })

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
      // Security: invoice lookup must be scoped to the caller's organization.
      expect(mockInvoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "inv-1",
            status: "OPEN",
            billingAccount: { organizationId: "org-1" },
          }),
        })
      )
    })
    it("dispatches confirmation email to invoice contacts", async () => {
      mockInvoice.findFirst.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        currency: "IDR",
        status: "OPEN",
      })
      mockPaymentConfirmation.findFirst.mockResolvedValueOnce(null)
      mockPaymentConfirmation.create.mockResolvedValueOnce({
        id: "conf-new",
        status: "PENDING",
        invoiceId: "inv-1",
        amount: 100000,
        senderName: "Sender",
        bankAccount: { bankName: "BCA" },
      })
      mockResolveInvoiceEmailRecipients.mockResolvedValueOnce([
        { email: "finance@example.com" },
      ])

      await service.create({
        invoiceId: "inv-1",
        organizationId: "org-1",
        data: {
          bankAccountId: "ba-1",
          amount: 100000,
          paymentDateTime: new Date(),
          senderName: "Sender",
        },
      })
      await Promise.resolve()
      await Promise.resolve()

      expect(mockSendPaymentConfirmationSubmitted).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv-1",
          invoiceNumber: "INV-001",
          amount: 100000,
          currency: "IDR",
          bankName: "BCA",
          senderName: "Sender",
          confirmationId: "conf-new",
        }),
        "finance@example.com"
      )
    })
    it("continues when recipient resolution fails", async () => {
      mockInvoice.findFirst.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        currency: "IDR",
        status: "OPEN",
      })
      mockPaymentConfirmation.findFirst.mockResolvedValueOnce(null)
      mockPaymentConfirmation.create.mockResolvedValueOnce({
        id: "conf-new",
        status: "PENDING",
        invoiceId: "inv-1",
        amount: 100000,
        bankAccount: { bankName: "BCA" },
      })
      mockResolveInvoiceEmailRecipients.mockRejectedValueOnce(
        new Error("recipient lookup failed")
      )

      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      )
      const result = await service.create({
        invoiceId: "inv-1",
        organizationId: "org-1",
        data: {
          bankAccountId: "ba-1",
          amount: 100000,
          paymentDateTime: new Date(),
        },
      })
      await Promise.resolve()
      await Promise.resolve()
      consoleErrorSpy.mockRestore()

      expect(result.id).toBe("conf-new")
      expect(mockSendPaymentConfirmationSubmitted).not.toHaveBeenCalled()
    })

    it("continues when a confirmation email fails to send", async () => {
      mockInvoice.findFirst.mockResolvedValueOnce({
        id: "inv-1",
        invoiceNumber: "INV-001",
        currency: "IDR",
        status: "OPEN",
      })
      mockPaymentConfirmation.findFirst.mockResolvedValueOnce(null)
      mockPaymentConfirmation.create.mockResolvedValueOnce({
        id: "conf-new",
        status: "PENDING",
        invoiceId: "inv-1",
        amount: 100000,
        bankAccount: { bankName: "BCA" },
      })
      mockResolveInvoiceEmailRecipients.mockResolvedValueOnce([
        { email: "finance@example.com" },
      ])
      mockSendPaymentConfirmationSubmitted.mockRejectedValueOnce(
        new Error("smtp unavailable")
      )

      const consoleErrorSpy = spyOn(console, "error").mockImplementation(
        () => {}
      )
      const result = await service.create({
        invoiceId: "inv-1",
        organizationId: "org-1",
        data: {
          bankAccountId: "ba-1",
          amount: 100000,
          paymentDateTime: new Date(),
        },
      })
      await Promise.resolve()
      await Promise.resolve()
      consoleErrorSpy.mockRestore()

      expect(result.id).toBe("conf-new")
      expect(mockSendPaymentConfirmationSubmitted).toHaveBeenCalled()
    })
  })
  describe("queries", () => {
    it("lists pending confirmations with pagination", async () => {
      const pending = [{ id: "conf-1", status: "PENDING" }]
      mockPaymentConfirmation.findMany.mockResolvedValueOnce(pending)

      const result = await service.listPending(10, 5)

      expect(result[0]?.id).toBe("conf-1")
      expect(mockPaymentConfirmation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PENDING" },
          take: 10,
          skip: 5,
        })
      )
    })

    it("finds a confirmation by id", async () => {
      const confirmation = { id: "conf-1", status: "PENDING" }
      mockPaymentConfirmation.findUnique.mockResolvedValueOnce(confirmation)

      const result = await service.findById("conf-1")

      expect(result?.id).toBe("conf-1")
      expect(mockPaymentConfirmation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "conf-1" } })
      )
    })
  })

  describe("reject", () => {
    it("rejects a pending confirmation and records an audit", async () => {
      mockPaymentConfirmation.findUnique.mockResolvedValueOnce({
        id: "conf-1",
        status: "PENDING",
      })

      await service.reject("conf-1", "admin-1", "Unmatched transfer")

      expect(mockPaymentConfirmation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "conf-1" },
          data: expect.objectContaining({
            status: "REJECTED",
            reviewedBy: "admin-1",
            rejectReason: "Unmatched transfer",
          }),
        })
      )
      expect(mockAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "PAYMENT_REJECTED",
            entityId: "conf-1",
          }),
        })
      )
    })

    it("throws when rejecting a missing confirmation", async () => {
      mockPaymentConfirmation.findUnique.mockResolvedValueOnce(null)

      await expect(
        service.reject("missing", "admin-1", "No payment")
      ).rejects.toThrow("Confirmation not found")
    })

    it("throws when rejecting an already processed confirmation", async () => {
      mockPaymentConfirmation.findUnique.mockResolvedValueOnce({
        id: "conf-1",
        status: "REJECTED",
      })

      await expect(
        service.reject("conf-1", "admin-1", "Duplicate")
      ).rejects.toThrow("Confirmation already processed")
    })
  })
})
