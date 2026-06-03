import { describe, it, expect, beforeEach, mock } from "bun:test"

const mockPrisma = {
  invoice: {
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

const { InvoiceExpirationService } = await import("./invoice-expiration.service")

describe("InvoiceExpirationService", () => {
  let service: InstanceType<typeof InvoiceExpirationService>

  beforeEach(() => {
    service = new InvoiceExpirationService()
    mockPrisma.invoice.updateMany.mockClear()
    mockPrisma.invoice.findMany.mockClear()
  })

  describe("expireOverdueInvoices", () => {
    it("should expire overdue invoices and return count", async () => {
      const result = await service.expireOverdueInvoices()

      expect(result.expired).toBe(2)
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledTimes(1)
      expect(mockPrisma.invoice.updateMany).toHaveBeenCalledWith({
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
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledTimes(1)
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
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

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledTimes(1)
    })
  })
})
