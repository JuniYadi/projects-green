import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockPrisma = {
  invoice: {
    create: mock(() =>
      Promise.resolve({
        id: "inv-123",
        invoiceNumber: "TOP-ABC123",
        totalAmount: { toNumber: () => 50000 },
        status: "OPEN",
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
      })
    ),
    create: mock(() =>
      Promise.resolve({
        id: "ba-123",
        organizationId: "org-123",
      })
    ),
    update: mock(() => Promise.resolve({})),
  },
  billingAdjustment: {
    create: mock(() => Promise.resolve({})),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const { PaymentService } = await import("./payment.service")

describe("PaymentService", () => {
  let service: InstanceType<typeof PaymentService>

  beforeEach(() => {
    service = new PaymentService()
    mockPrisma.invoice.create.mockClear()
    mockPrisma.invoice.update.mockClear()
    mockPrisma.invoice.findFirst.mockClear()
    mockPrisma.invoice.findMany.mockClear()
    mockPrisma.billingAccount.findUnique.mockClear()
    mockPrisma.billingAccount.create.mockClear()
    mockPrisma.billingAccount.update.mockClear()
    mockPrisma.billingAdjustment.create.mockClear()
  })

  describe("createTopupInvoice", () => {
    it("should create invoice with correct fields", async () => {
      const invoice = await service.createTopupInvoice({
        organizationId: "org-123",
        amount: 50000,
        paymentMethod: "VA",
        gatewayId: "gw-123",
      })

      expect(invoice.id).toBe("inv-123")
      expect(invoice.invoiceNumber).toMatch(/^TOP-/)
      expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(1)
    })

    it("should throw error for amount below minimum", async () => {
      await expect(
        service.createTopupInvoice({
          organizationId: "org-123",
          amount: 5000,
        })
      ).rejects.toThrow("Minimum top-up amount is 10000")
    })

    it("should throw error for amount above maximum", async () => {
      await expect(
        service.createTopupInvoice({
          organizationId: "org-123",
          amount: 200000000,
        })
      ).rejects.toThrow("Maximum top-up amount is 100000000")
    })

    it("should create billing account if not exists", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof mock>).mockResolvedValueOnce(
        null
      )

      await service.createTopupInvoice({
        organizationId: "org-new",
        amount: 50000,
      })

      expect(mockPrisma.billingAccount.create).toHaveBeenCalledTimes(1)
    })
  })

  describe("getInvoicesForOrganization", () => {
    it("should return invoices for organization", async () => {
      const invoices = await service.getInvoicesForOrganization("org-123")

      expect(Array.isArray(invoices)).toBe(true)
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledTimes(1)
    })
  })

  describe("markInvoiceAsPaid", () => {
    it("should update invoice status to PAID", async () => {
      await service.markInvoiceAsPaid("inv-123")

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: "inv-123" },
        data: { status: "PAID" },
      })
    })
  })

  describe("creditBalance", () => {
    it("should create adjustment and update balance", async () => {
      await service.creditBalance("org-123", 50000, "DUITKU_REF001")

      expect(mockPrisma.billingAdjustment.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.billingAccount.update).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
        data: { balance: { increment: 50000 } },
      })
    })

    it("should throw error when billing account not found", async () => {
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof mock>).mockResolvedValueOnce(
        null
      )

      await expect(
        service.creditBalance("org-notfound", 50000, "REF001")
      ).rejects.toThrow("Billing account not found")
    })
  })

  describe("payWithBalance", () => {
    it("should debit balance and mark invoice as paid", async () => {
      ;(mockPrisma.invoice.findFirst as ReturnType<typeof mock>).mockResolvedValueOnce({
        id: "inv-123",
        status: "OPEN",
        totalAmount: { toNumber: () => 50000 },
        invoiceNumber: "TOP-ABC123",
        currency: "IDR",
      })

      await service.payWithBalance("inv-123", "org-123")

      expect(mockPrisma.billingAdjustment.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.billingAccount.update).toHaveBeenCalledWith({
        where: { organizationId: "org-123" },
        data: { balance: { decrement: 50000 } },
      })
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: "inv-123" },
        data: { status: "PAID" },
      })
    })

    it("should throw error when invoice not found", async () => {
      ;(mockPrisma.invoice.findFirst as ReturnType<typeof mock>).mockResolvedValueOnce(null)

      await expect(
        service.payWithBalance("inv-notfound", "org-123")
      ).rejects.toThrow("Invoice not found or not open")
    })

    it("should throw error when insufficient balance", async () => {
      ;(mockPrisma.invoice.findFirst as ReturnType<typeof mock>).mockResolvedValueOnce({
        id: "inv-123",
        status: "OPEN",
        totalAmount: { toNumber: () => 200000 },
        invoiceNumber: "TOP-ABC123",
        currency: "IDR",
      })
      ;(mockPrisma.billingAccount.findUnique as ReturnType<typeof mock>).mockResolvedValueOnce({
        id: "ba-123",
        organizationId: "org-123",
        balance: { toNumber: () => 50000 },
      })

      await expect(
        service.payWithBalance("inv-123", "org-123")
      ).rejects.toThrow("Insufficient balance")
    })
  })
})
