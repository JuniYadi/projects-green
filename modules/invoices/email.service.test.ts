import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// Mock console.error to suppress error logging in tests
const mockConsoleError = mock(() => {})
console.error = mockConsoleError

const mockSendEmail = mock(async () => {})

mock.module("@/lib/queue/email", () => ({
  sendEmail: mockSendEmail,
}))

const mockRender = mock(async () => "<html><body>Test Email</body></html>")
mock.module("@react-email/components", () => ({
  render: mockRender,
}))

mock.module("./emails/invoice-created", () => ({
  InvoiceCreatedEmail: () => "<div>Invoice Created</div>",
}))
mock.module("./emails/payment-reminder", () => ({
  PaymentReminderEmail: () => "<div>Payment Reminder</div>",
}))
mock.module("./emails/invoice-paid", () => ({
  InvoicePaidEmail: () => "<div>Invoice Paid</div>",
}))
mock.module("./emails/invoice-overdue", () => ({
  InvoiceOverdueEmail: () => "<div>Invoice Overdue</div>",
}))
mock.module("./emails/invoice-cancelled", () => ({
  InvoiceCancelledEmail: () => "<div>Invoice Cancelled</div>",
}))

const mockInvoice = {
  id: "inv-123",
  invoiceNumber: "INV-2026-001",
  issuedAt: "2026-05-01T00:00:00.000Z",
  dueAt: "2026-05-15T00:00:00.000Z",
  totalAmount: 150.0,
  currency: "USD",
  status: "open" as const,
}

describe("invoiceEmailService", () => {
  let emailService: import("./email.service").InvoiceEmailService
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    mockSendEmail.mockClear()
    mockRender.mockClear()

    originalEnv = { ...process.env, NODE_ENV: "test" }
    process.env.EMAIL_FROM = "Billing <billing@test.com>"
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3300"

    const module = await import("./email.service")
    emailService = module.createInvoiceEmailService()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("sendInvoiceCreated", () => {
    it("sends email with correct subject and recipient", async () => {
      await emailService.sendInvoiceCreated(mockInvoice, "user@example.com")

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining(mockInvoice.invoiceNumber),
        })
      )
    })

    it("renders the invoice created template", async () => {
      await emailService.sendInvoiceCreated(mockInvoice, "user@example.com")

      expect(mockRender).toHaveBeenCalled()
    })
  })

  describe("sendPaymentReminder", () => {
    it("sends reminder email with due date context", async () => {
      await emailService.sendPaymentReminder(mockInvoice, "user@example.com")

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining("Reminder"),
        })
      )
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining(mockInvoice.invoiceNumber),
        })
      )
    })

    it("passes invoice data to template", async () => {
      await emailService.sendPaymentReminder(mockInvoice, "user@example.com")

      expect(mockRender).toHaveBeenCalled()
    })
  })

  describe("sendInvoicePaid", () => {
    const paidInvoice = {
      ...mockInvoice,
      status: "paid" as const,
      paidAt: "2026-05-10T00:00:00.000Z",
    }

    it("sends payment confirmation email", async () => {
      await emailService.sendInvoicePaid(paidInvoice, "user@example.com")

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining("Payment Received"),
        })
      )
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining(mockInvoice.invoiceNumber),
        })
      )
    })
  })

  describe("sendInvoiceOverdue", () => {
    it("sends overdue email with urgent subject", async () => {
      await emailService.sendInvoiceOverdue(mockInvoice, "user@example.com")

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining("OVERDUE"),
        })
      )
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining(mockInvoice.invoiceNumber),
        })
      )
    })
  })

  describe("sendInvoiceCancelled", () => {
    const canceledInvoice = {
      ...mockInvoice,
      status: "canceled" as const,
    }

    it("sends cancellation email", async () => {
      await emailService.sendInvoiceCancelled(
        canceledInvoice,
        "user@example.com"
      )

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining("Cancelled"),
        })
      )
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining(mockInvoice.invoiceNumber),
        })
      )
    })

    it("includes reason when provided", async () => {
      await emailService.sendInvoiceCancelled(
        canceledInvoice,
        "user@example.com",
        "Test cancellation reason"
      )

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
        })
      )
    })
  })

  describe("error handling", () => {
    it("throws InvoiceEmailServiceError when sendEmail fails", async () => {
      mockSendEmail.mockImplementation(async () => {
        throw new Error("Queue enqueue failed")
      })

      await expect(
        emailService.sendInvoiceCreated(mockInvoice, "user@example.com")
      ).rejects.toThrow("Failed to send invoice created notification")
    })

    it("throws InvoiceEmailServiceError when render fails", async () => {
      mockRender.mockImplementation(async () => {
        throw new Error("Template rendering failed")
      })

      await expect(
        emailService.sendInvoiceCreated(mockInvoice, "user@example.com")
      ).rejects.toThrow("Failed to send invoice created notification")
    })

    it("sendPaymentReminder throws on render failure", async () => {
      mockRender.mockImplementation(async () => {
        throw new Error("Reminder render failed")
      })

      await expect(
        emailService.sendPaymentReminder(mockInvoice, "user@example.com")
      ).rejects.toThrow("Failed to send payment reminder notification")
    })

    it("sendInvoicePaid throws on render failure", async () => {
      mockRender.mockImplementation(async () => {
        throw new Error("Paid render failed")
      })

      await expect(
        emailService.sendInvoicePaid(mockInvoice, "user@example.com")
      ).rejects.toThrow("Failed to send invoice paid notification")
    })

    it("sendInvoiceOverdue throws on render failure", async () => {
      mockRender.mockImplementation(async () => {
        throw new Error("Overdue render failed")
      })

      await expect(
        emailService.sendInvoiceOverdue(mockInvoice, "user@example.com")
      ).rejects.toThrow("Failed to send invoice overdue notification")
    })

    it("sendInvoiceCancelled throws on render failure", async () => {
      mockRender.mockImplementation(async () => {
        throw new Error("Cancelled render failed")
      })

      await expect(
        emailService.sendInvoiceCancelled(mockInvoice, "user@example.com")
      ).rejects.toThrow("Failed to send invoice cancelled notification")
    })
  })

  describe("getInvoiceEmailData", () => {
    it("formats currency amount correctly", async () => {
      const module = await import("./email.service")
      const data = module.getInvoiceEmailData(mockInvoice)

      expect(data.amount).toBe("$150.00")
    })

    it("formats dates correctly", async () => {
      const module = await import("./email.service")
      const data = module.getInvoiceEmailData(mockInvoice)

      expect(data.issuedAt).toBe("May 1, 2026")
      expect(data.dueAt).toBe("May 15, 2026")
    })
  })
})
