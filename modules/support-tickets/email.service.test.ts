import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// Mock console.error to suppress error logging in tests
const mockConsoleError = mock(() => {})
console.error = mockConsoleError

const mockSendEmail = mock(async () => {})

mock.module("@/lib/queue/email", () => ({
  sendEmail: mockSendEmail,
}))

// Mock React Email render
const mockRender = mock(async () => "<html><body>Test Email</body></html>")
mock.module("@react-email/components", () => ({
  render: mockRender,
}))

// Mock the email templates - they use @react-email/components internally
mock.module("./emails/ticket-created", () => ({
  TicketCreatedEmail: () => "<div>Ticket Created</div>",
}))
mock.module("./emails/ticket-replied", () => ({
  TicketRepliedEmail: () => "<div>Ticket Replied</div>",
}))
mock.module("./emails/ticket-closed", () => ({
  TicketClosedEmail: () => "<div>Ticket Closed</div>",
}))
mock.module("./emails/ticket-new-admin-alert", () => ({
  TicketNewAdminAlertEmail: () => "<div>New Ticket Admin Alert</div>",
}))

const mockTicket = {
  id: "ticket-123",
  ticketNumber: "TCK-12345678-ABCDEF",
  organizationId: "org-123",
  requesterWorkosUserId: "user-123",
  assignedAgentWorkosUserId: null,
  department: "technical" as const,
  priority: "medium" as const,
  service: "billing" as const,
  status: "open" as const,
  subject: "Test Support Ticket",
  description: "This is a test ticket description",
  secureForm: null,
  attachmentMetadata: [],
  closedAt: null,
  createdAt: new Date(),
  resolvedAt: null,
  updatedAt: new Date(),
}

const mockReply = {
  id: "reply-123",
  ticketId: "ticket-123",
  authorWorkosUserId: "user-456",
  body: "This is a reply to the ticket",
  isInternalNote: false,
  secureForm: null,
  attachmentMetadata: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe("emailService", () => {
  let emailService: import("./email.service").EmailService
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    mockSendEmail.mockClear()
    mockRender.mockClear()

    originalEnv = { ...process.env, NODE_ENV: "test" }
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3300"

    const module = await import("./email.service")
    emailService = module.createEmailService()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("sendTicketCreated", () => {
    it("sends email with correct subject and recipient", async () => {
      await emailService.sendTicketCreated(mockTicket, "user@example.com")

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining(mockTicket.ticketNumber),
        })
      )
    })

    it("renders the ticket created email template", async () => {
      await emailService.sendTicketCreated(mockTicket, "user@example.com")

      expect(mockRender).toHaveBeenCalled()
    })
  })

  describe("sendTicketReplied", () => {
    it("sends email with reply subject line", async () => {
      await emailService.sendTicketReplied(
        mockTicket,
        mockReply,
        "user@example.com"
      )

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining(mockTicket.ticketNumber),
        })
      )
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining(mockTicket.subject),
        })
      )
    })

    it("passes ticket and reply to template", async () => {
      await emailService.sendTicketReplied(
        mockTicket,
        mockReply,
        "user@example.com"
      )

      expect(mockRender).toHaveBeenCalled()
    })
  })

  describe("sendTicketClosed", () => {
    const closedTicket = {
      ...mockTicket,
      status: "closed" as const,
      closedAt: new Date(),
    }

    it("sends email with closed status in subject", async () => {
      await emailService.sendTicketClosed(closedTicket, "user@example.com")

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.stringContaining("closed"),
        })
      )
    })

    it("uses resolved status for resolved tickets", async () => {
      const resolvedTicket = {
        ...mockTicket,
        status: "resolved" as const,
        resolvedAt: new Date(),
      }

      await emailService.sendTicketClosed(resolvedTicket, "user@example.com")

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("resolved"),
        })
      )
    })
  })

  describe("error handling", () => {
    it("throws EmailServiceError when sendEmail fails", async () => {
      mockSendEmail.mockImplementation(async () => {
        throw new Error("Queue enqueue failed")
      })

      await expect(
        emailService.sendTicketCreated(mockTicket, "user@example.com")
      ).rejects.toThrow("Failed to send ticket created notification")
    })

    it("throws EmailServiceError when render fails", async () => {
      mockRender.mockImplementation(async () => {
        throw new Error("Template rendering failed")
      })

      await expect(
        emailService.sendTicketCreated(mockTicket, "user@example.com")
      ).rejects.toThrow("Failed to send ticket created notification")
    })
  })
})
