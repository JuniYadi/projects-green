import { describe, it, expect, mock, beforeEach } from "bun:test"
import type { PrismaClient } from "@prisma/client"
import type { InvoiceEmailService } from "@/modules/invoices/email.service"

const mockFindMany = mock()
const mockUpdate = mock()
const mockSendPaymentReminder = mock()

const mockBillingAccountFindUnique = mock()

const mockPrismaClient = {
  billingInvoice: {
    findMany: mockFindMany,
    update: mockUpdate,
  },
  billingAccount: {
    findUnique: mockBillingAccountFindUnique,
  },
}

const mockEmailService: Partial<InvoiceEmailService> = {
  sendPaymentReminder: mockSendPaymentReminder,
}

mock.module("@/lib/prisma", () => ({
  prisma: mockPrismaClient,
}))

import { InvoiceStatusManager } from "./invoice-status.service"

describe("InvoiceStatusManager", () => {
  let manager: InvoiceStatusManager

  beforeEach(() => {
    mock.clearAllMocks()

    // Default: return account with no contacts (tests that don't need billing contacts)
    mockBillingAccountFindUnique.mockResolvedValue({
      id: "ba_default",
      organizationId: "org-default",
      contacts: [],
    })

    manager = new InvoiceStatusManager(
      mockPrismaClient as unknown as PrismaClient,
      mockEmailService as InvoiceEmailService,
    )
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

    it("handles invoices with unknown status mapping", async () => {
      const now = new Date()
      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-unknown",
          invoiceNumber: "INV-999",
          totalAmount: { toNumber: () => 50 },
          currency: "USD",
          status: "SOME_UNKNOWN_STATUS",
          periodStart: now,
          periodEnd: now,
          issuedAt: null,
          dueAt: null,
          billingAccount: { organizationId: "org-1" },
        },
      ])
      mockUpdate.mockResolvedValue({})

      const result = await manager.issueDraftInvoices()
      expect(result.issued).toBe(1)
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

  describe("sendPaymentReminders", () => {
    it("sends reminders for ISSUED invoices due within 3 days", async () => {
      const now = new Date()
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 2) // due in 2 days

      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-4",
          invoiceNumber: "INV-004",
          totalAmount: { toNumber: () => 400 },
          currency: "USD",
          status: "ISSUED",
          periodStart: now,
          periodEnd: now,
          issuedAt: now,
          dueAt: dueDate,
          billingAccount: { organizationId: "org-3" },
          metadataJson: null,
        },
      ])
      mockUpdate.mockResolvedValue({})
      // Mock sendPaymentReminder to succeed
      mockSendPaymentReminder.mockResolvedValue(undefined)

      const result = await manager.sendPaymentReminders()

      expect(result.sent).toBe(1) // emailService exists, so 1 sent
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          status: "ISSUED",
          dueAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        include: { billingAccount: true },
      })
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "inv-4" },
        data: {
          metadataJson: {
            lastReminderAt: expect.any(String),
            reminderCount: 1,
          },
        },
      })
    })

    it("skips invoices that already received a reminder today (idempotency)", async () => {
      const now = new Date()
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 2)

      // Invoice with reminder sent earlier today
      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-5",
          invoiceNumber: "INV-005",
          totalAmount: { toNumber: () => 500 },
          currency: "USD",
          status: "ISSUED",
          periodStart: now,
          periodEnd: now,
          issuedAt: now,
          dueAt: dueDate,
          billingAccount: { organizationId: "org-4" },
          metadataJson: {
            lastReminderAt: now.toISOString(), // sent today
            reminderCount: 2,
          },
        },
      ])

      const result = await manager.sendPaymentReminders()

      // Should skip due to idempotency check
      expect(result.sent).toBe(0)
      expect(mockUpdate).not.toHaveBeenCalled() // no update since we skipped
    })

    it("increments reminderCount for invoices that received previous reminders", async () => {
      const now = new Date()
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 1)

      // Invoice with reminder sent yesterday
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-6",
          invoiceNumber: "INV-006",
          totalAmount: { toNumber: () => 600 },
          currency: "USD",
          status: "ISSUED",
          periodStart: now,
          periodEnd: now,
          issuedAt: now,
          dueAt: dueDate,
          billingAccount: { organizationId: "org-5" },
          metadataJson: {
            lastReminderAt: yesterday.toISOString(), // sent yesterday
            reminderCount: 3,
          },
        },
      ])
      mockUpdate.mockResolvedValue({})
      mockSendPaymentReminder.mockResolvedValue(undefined)

      const result = await manager.sendPaymentReminders()

      expect(result.sent).toBe(1)
      expect(mockUpdate).toHaveBeenCalledTimes(1)
      // Verify reminderCount was incremented from 3 to 4
      const updateCall = mockUpdate.mock.calls[0][0]
      expect(updateCall.data.metadataJson.reminderCount).toBe(4)
      expect(updateCall.data.metadataJson.lastReminderAt).toBe(now.toISOString())
    })

    it("returns 0 when no invoices are due within reminder window", async () => {
      mockFindMany.mockResolvedValueOnce([])

      const result = await manager.sendPaymentReminders()

      expect(result.sent).toBe(0)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it("handles sendPaymentReminders gracefully when no admin email resolved", async () => {
      // This tests the path where resolveOrgAdminEmail returns null
      // (either via WorkOS returning no admin, or WorkOS import failure caught by the try/catch)
      const now = new Date()
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 2)

      mockFindMany.mockResolvedValueOnce([
        {
          id: "inv-no-admin",
          invoiceNumber: "INV-007",
          totalAmount: { toNumber: () => 700 },
          currency: "USD",
          status: "ISSUED",
          periodStart: now,
          periodEnd: now,
          issuedAt: now,
          dueAt: dueDate,
          billingAccount: { organizationId: "org-no-admin" },
          metadataJson: null,
        },
      ])
      mockUpdate.mockResolvedValue({})

      const result = await manager.sendPaymentReminders()

      // sent counts the attempt, not the successful email delivery
      expect(result.sent).toBe(1)
    })
  })
})
