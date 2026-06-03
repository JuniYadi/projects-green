import { describe, it, expect, mock, beforeEach } from "bun:test"

const mockUpdateMany = mock()

const mockPrismaClient = {
  invoice: {
    updateMany: mockUpdateMany,
  },
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

import { InvoiceStatusManager } from "./invoice-status.service"

describe("InvoiceStatusManager", () => {
  let manager: InvoiceStatusManager

  beforeEach(() => {
    mock.clearAllMocks()
    manager = new InvoiceStatusManager(mockPrismaClient as any)
  })

  describe("issueDraftInvoices", () => {
    it("transitions DRAFT invoices older than 5 days to ISSUED", async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 3 })

      const result = await manager.issueDraftInvoices()

      expect(result.issued).toBe(3)
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          status: "DRAFT",
          createdAt: { lt: expect.any(Date) },
        },
        data: {
          status: "ISSUED",
          issuedAt: expect.any(Date),
        },
      })
    })

    it("returns 0 when no DRAFT invoices are older than 5 days", async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 0 })

      const result = await manager.issueDraftInvoices()

      expect(result.issued).toBe(0)
    })
  })

  describe("markOverdueInvoices", () => {
    it("marks ISSUED invoices past dueAt + 14 days as OVERDUE", async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 2 })

      const result = await manager.markOverdueInvoices()

      expect(result.overdue).toBe(2)
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: {
          status: "ISSUED",
          dueAt: { lt: expect.any(Date) },
        },
        data: {
          status: "OVERDUE",
        },
      })
    })

    it("returns 0 when no invoices are overdue", async () => {
      mockUpdateMany.mockResolvedValueOnce({ count: 0 })

      const result = await manager.markOverdueInvoices()

      expect(result.overdue).toBe(0)
    })
  })

  describe("runDailyTransitions", () => {
    it("runs both issue and overdue transitions", async () => {
      mockUpdateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })

      const result = await manager.runDailyTransitions()

      expect(result).toEqual({ issued: 1, overdue: 0 })
      expect(mockUpdateMany).toHaveBeenCalledTimes(2)
    })
  })
})
