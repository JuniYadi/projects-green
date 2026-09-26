import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

// Mock console.error to suppress error logging in tests
const mockConsoleError = mock(() => {})
console.error = mockConsoleError

const mockCreateEmailLog = mock(async () => "email-log-123")

mock.module("@/lib/email-log", () => ({
  createEmailLog: mockCreateEmailLog,
  redactEmailHtml: (html: string) => html,
}))

const mockSendEmail = mock(
  async (_data?: unknown, _opts?: { jobId?: string }) => {}
)

mock.module("@/lib/queue/email", () => ({
  sendEmail: mockSendEmail,
}))

const mockRender = mock(
  async (_element?: unknown) => "<html><body>Test Email</body></html>"
)
const passthrough = ({ children }: { children?: unknown }) => children
mock.module("react-email", () => ({
  render: mockRender,
  Body: passthrough,
  Button: passthrough,
  Column: passthrough,
  Container: passthrough,
  Head: passthrough,
  Heading: passthrough,
  Hr: passthrough,
  Html: passthrough,
  Img: passthrough,
  Link: passthrough,
  Preview: passthrough,
  Row: passthrough,
  Section: passthrough,
  Text: passthrough,
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
mock.module("./emails/topup-received-admin-notice", () => ({
  TopupReceivedAdminNotice: () => "<div>Top-up received</div>",
}))

const mockEmailLogCreate = mock(async () => ({ id: "notice-log-1" }))
const mockEmailLogFindUnique = mock(
  async (): Promise<{
    id: string
    status: string
  } | null> => null
)
const mockEmailLogUpdate = mock(async () => ({}))
mock.module("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      create: mockEmailLogCreate,
      findUnique: mockEmailLogFindUnique,
      update: mockEmailLogUpdate,
    },
  },
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
    mockCreateEmailLog.mockClear()
    mockSendEmail.mockClear()
    mockRender.mockClear()
    mockEmailLogCreate.mockClear()
    mockEmailLogFindUnique.mockClear()
    mockEmailLogUpdate.mockClear()
    mockSendEmail.mockImplementation(async () => {})
    mockRender.mockImplementation(async () => "<html>Test Email</html>")
    mockEmailLogCreate.mockImplementation(async () => ({ id: "notice-log-1" }))
    mockEmailLogFindUnique.mockImplementation(async () => null)
    mockEmailLogUpdate.mockImplementation(async () => ({}))

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

    it("renders Billed To from options, never the positional recipient", async () => {
      await emailService.sendInvoiceCreated(
        mockInvoice,
        "recipient@example.com",
        "org-123",
        { organizationName: "Acme Corp", billedToEmail: "billing@acme.com" }
      )

      const [element] = mockRender.mock.calls[0] as [
        { props: Record<string, unknown> },
      ]
      expect(element.props.billedToEmail).toBe("billing@acme.com")
      expect(element.props.billedToEmail).not.toBe("recipient@example.com")
      expect(element.props.organizationName).toBe("Acme Corp")
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

    it("renders Billed To from options, never the positional recipient", async () => {
      await emailService.sendInvoicePaid(
        paidInvoice,
        "recipient@example.com",
        "org-123",
        { organizationName: "Acme Corp", billedToEmail: "billing@acme.com" }
      )

      const [element] = mockRender.mock.calls[0] as [
        { props: Record<string, unknown> },
      ]
      expect(element.props.billedToEmail).toBe("billing@acme.com")
      expect(element.props.billedToEmail).not.toBe("recipient@example.com")
      expect(element.props.organizationName).toBe("Acme Corp")
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
  describe("sendPaymentConfirmationSubmitted", () => {
    const confirmation = {
      invoiceId: "inv-123",
      invoiceNumber: "INV-2026-001",
      amount: 150,
      currency: "USD",
      bankName: "Test Bank",
      senderName: "Test Sender",
      confirmationId: "conf-123",
    }

    it("logs the submitted confirmation event type", async () => {
      await emailService.sendPaymentConfirmationSubmitted(
        confirmation,
        "finance@example.com"
      )

      expect(mockCreateEmailLog).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "PAYMENT_CONFIRMATION_SUBMITTED",
        })
      )
    })

    it("sends a submitted confirmation email", async () => {
      await emailService.sendPaymentConfirmationSubmitted(
        confirmation,
        "finance@example.com"
      )

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "finance@example.com",
          subject: expect.stringContaining("Payment Confirmation Submitted"),
        })
      )
    })

    it("renders the submitted confirmation template", async () => {
      await emailService.sendPaymentConfirmationSubmitted(
        confirmation,
        "finance@example.com"
      )

      expect(mockRender).toHaveBeenCalled()
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

    it("maps line items and cost breakdown when detail is provided", async () => {
      const module = await import("./email.service")
      const detailInvoice = {
        ...mockInvoice,
        subtotalAmount: 140,
        taxAmount: 10,
        discountAmount: 0,
        periodStart: "2026-05-01T00:00:00.000Z",
        periodEnd: "2026-05-31T00:00:00.000Z",
        paidAt: "2026-05-10T00:00:00.000Z",
        paymentMethod: "Bank Transfer",
        type: "SUBSCRIPTION",
        lineItems: [
          {
            id: "li-1",
            description: "VPN Plan",
            quantity: 1,
            unitPrice: 140,
            amount: 140,
            currency: "USD",
          },
        ],
      }

      const data = module.getInvoiceEmailData(
        detailInvoice,
        "payer@org.com",
        "Acme Corp"
      )

      expect(data.subtotalAmount).toBe("$140.00")
      expect(data.taxAmount).toBe("$10.00")
      expect(data.billedToEmail).toBe("payer@org.com")
      expect(data.organizationName).toBe("Acme Corp")
      expect(data.lineItems).toBeDefined()
      expect(data.lineItems?.[0].description).toBe("VPN Plan")
      expect(data.paymentMethod).toBe("Bank Transfer")
      expect(data.paidAt).toBe("May 10, 2026")
    })
  })

  describe("sendTopupReceivedAdminNotice", () => {
    const topupData = {
      invoiceId: "inv-123",
      organizationId: "org-123",
      organizationName: "Acme",
      actorEmail: "payer@org.com",
      amount: 50000,
      currency: "IDR",
      paymentMethod: "VA",
      paidAt: new Date("2026-09-26T00:00:00.000Z"),
    }

    it("claims the log before enqueueing, with a colon-free jobId", async () => {
      await emailService.sendTopupReceivedAdminNotice(
        topupData,
        "admin@org.com"
      )

      expect(mockEmailLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventKey: "topup-admin:inv-123",
          recipientEmail: "admin@org.com",
          type: "TOPUP_RECEIVED_ADMIN_NOTICE",
          status: "QUEUED",
        }),
      })
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@org.com",
          emailLogId: "notice-log-1",
        }),
        { jobId: "topup-admin_inv-123" }
      )
      expect(mockSendEmail.mock.calls[0][1]!.jobId).not.toContain(":")

      const createOrder = mockEmailLogCreate.mock.invocationCallOrder[0]
      const sendOrder = mockSendEmail.mock.invocationCallOrder[0]
      expect(createOrder).toBeLessThan(sendOrder)
    })

    it("does not enqueue a duplicate when the existing row is already SENT", async () => {
      mockEmailLogCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Duplicate event", {
          code: "P2002",
          clientVersion: "7.10.0",
        })
      )
      mockEmailLogFindUnique.mockResolvedValueOnce({
        id: "notice-log-1",
        status: "SENT",
      })

      await expect(
        emailService.sendTopupReceivedAdminNotice(topupData, "admin@org.com")
      ).resolves.toBeUndefined()
      expect(mockSendEmail).not.toHaveBeenCalled()
    })

    it("re-enqueues a duplicate with the same jobId and existing id when not yet SENT", async () => {
      mockEmailLogCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Duplicate event", {
          code: "P2002",
          clientVersion: "7.10.0",
        })
      )
      mockEmailLogFindUnique.mockResolvedValueOnce({
        id: "existing-log-1",
        status: "FAILED",
      })

      await emailService.sendTopupReceivedAdminNotice(
        topupData,
        "admin@org.com"
      )

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ emailLogId: "existing-log-1" }),
        { jobId: "topup-admin_inv-123" }
      )
    })

    it("leaves the claim retryable when enqueue fails", async () => {
      mockSendEmail.mockRejectedValueOnce(new Error("Queue unavailable"))

      await expect(
        emailService.sendTopupReceivedAdminNotice(topupData, "admin@org.com")
      ).rejects.toThrow("Queue unavailable")

      expect(mockEmailLogUpdate).toHaveBeenCalledWith({
        where: { id: "notice-log-1" },
        data: { status: "FAILED" },
      })

      mockEmailLogCreate.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Duplicate event", {
          code: "P2002",
          clientVersion: "7.10.0",
        })
      )
      mockEmailLogFindUnique.mockResolvedValueOnce({
        id: "notice-log-1",
        status: "FAILED",
      })

      await emailService.sendTopupReceivedAdminNotice(
        topupData,
        "admin@org.com"
      )

      expect(mockSendEmail).toHaveBeenCalledTimes(2)
      expect(mockSendEmail.mock.calls[1]).toEqual([
        expect.objectContaining({ emailLogId: "notice-log-1" }),
        { jobId: "topup-admin_inv-123" },
      ])
    })
  })
})
