import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PrismaClient } from "@prisma/client"

const mockFindMany = mock()
const mockUpdate = mock()

const mockPrismaClient = {
  invoice: {
    findMany: mockFindMany,
    update: mockUpdate,
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
    manager = new InvoiceStatusManager(mockPrismaClient as unknown as PrismaClient)
  })

  describe("issueDraftInvoices", () => {
    it("transitions DRAFT invoices older than 5 days to ISSUED", async () => {
      const now = new Date()
      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-1",
          invoiceNumber: "INV-001",
          totalAmount: { toNumber: () => 100 },
          currency: "USD",
          status: "DRAFT",
          periodStart: now,
          periodEnd: now,
          issuedAt: null,
          dueAt: null,
          billingAccount: { organizationId: "org-1" },
        },
        {
          id: "inv-2",
          invoiceNumber: "INV-002",
          totalAmount: { toNumber: () => 200 },
          currency: "USD",
          status: "DRAFT",
          periodStart: now,
          periodEnd: now,
          issuedAt: null,
          dueAt: null,
          billingAccount: { organizationId: "org-1" },
        },
      ])
      mockUpdate.mockResolvedValue({})

      const result = await manager.issueDraftInvoices()

      expect(result.issued).toBe(2)
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          status: "DRAFT",
          createdAt: { lt: expect.any(Date) },
        },
        include: { billingAccount: true },
      })
      expect(mockUpdate).toHaveBeenCalledTimes(2)
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: {
          status: "ISSUED",
          issuedAt: expect.any(Date),
        },
      })
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "inv-2" },
        data: {
          status: "ISSUED",
          issuedAt: expect.any(Date),
        },
      })
    })

    it("returns 0 when no DRAFT invoices are older than 5 days", async () => {
      mockFindMany.mockResolvedValueOnce([])

      const result = await manager.issueDraftInvoices()

      expect(result.issued).toBe(0)
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe("markOverdueInvoices", () => {
    it("marks ISSUED invoices past dueAt + 14 days as OVERDUE", async () => {
      const now = new Date()
      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-3",
          invoiceNumber: "INV-003",
          totalAmount: { toNumber: () => 300 },
          currency: "USD",
          status: "ISSUED",
          periodStart: now,
          periodEnd: now,
          issuedAt: now,
          dueAt: now,
          billingAccount: { organizationId: "org-2" },
        },
      ])
      mockUpdate.mockResolvedValue({})

      const result = await manager.markOverdueInvoices()

      expect(result.overdue).toBe(1)
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          status: "ISSUED",
          dueAt: { lt: expect.any(Date) },
        },
        include: { billingAccount: true },
      })
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "inv-3" },
        data: { status: "OVERDUE" },
      })
    })

    it("returns 0 when no invoices are overdue", async () => {
      mockFindMany.mockResolvedValueOnce([])

      const result = await manager.markOverdueInvoices()

      expect(result.overdue).toBe(0)
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe("runDailyTransitions", () => {
    it("runs both issue and overdue transitions", async () => {
      mockFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await manager.runDailyTransitions()

      expect(result).toEqual({ issued: 0, overdue: 0 })
      expect(mockFindMany).toHaveBeenCalledTimes(2)
    })
  })
})
