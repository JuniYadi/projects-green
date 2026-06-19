import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockPrisma = {
  billingInvoice: {
    updateMany: mock(() => Promise.resolve({ count: 2 })),
    findMany: mock(() =>
      Promise.resolve([
        {
          id: "inv-001",
          invoiceNumber: "TOP-ABC123",
          status: "OPEN",
          dueDate: new Date("2026-06-01"),
          createdAt: new Date("2026-05-25"),
          billingAccount: { organizationId: "org-123" },
        },
      ])
    ),
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const { InvoiceExpirationService } =
  await import("./invoice-expiration.service")

describe("InvoiceExpirationService", () => {
  let service: InstanceType<typeof InvoiceExpirationService>

  beforeEach(() => {
    service = new InvoiceExpirationService()
    mockPrisma.billingInvoice.updateMany.mockClear()
    mockPrisma.billingInvoice.findMany.mockClear()
  })

  describe("expireOverdueInvoices", () => {
    it("should expire overdue invoices and return count", async () => {
      const result = await service.expireOverdueInvoices()

      expect(result.expired).toBe(2)
      expect(mockPrisma.billingInvoice.updateMany).toHaveBeenCalledTimes(1)
      expect(mockPrisma.billingInvoice.updateMany).toHaveBeenCalledWith({
        where: {
          status: "OPEN",
          createdAt: { lt: expect.any(Date) },
        },
        data: { status: "VOID" },
      })
    })
  })

  describe("getExpiringInvoices", () => {
    it("should return invoices expiring within threshold", async () => {
      const invoices = await service.getExpiringInvoices(24)

      expect(invoices).toHaveLength(1)
      expect(mockPrisma.billingInvoice.findMany).toHaveBeenCalledTimes(1)
      expect(mockPrisma.billingInvoice.findMany).toHaveBeenCalledWith({
        where: {
          status: "OPEN",
          dueDate: { lte: expect.any(Date) },
        },
        include: {
          billingAccount: { select: { organizationId: true } },
        },
      })
    })

    it("should use default threshold of 24 hours", async () => {
      await service.getExpiringInvoices()

      expect(mockPrisma.billingInvoice.findMany).toHaveBeenCalledTimes(1)
    })
  })
})
