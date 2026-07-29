import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"
import { createMockPrisma } from "@/test/helpers/prisma-mock"

const { prisma: mockPrisma, mock: mockMethods } = createMockPrisma({
  emailLog: ["create"],
})

mock.module("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

import { createEmailLog, redactEmailHtml } from "./email-log"

describe("redactEmailHtml", () => {
  it("redacts passwords and GitHub tokens while preserving HTML", () => {
    const html =
      "<p>Welcome</p><input password=correct-horse>" +
      "<p>token=ghp_123456789012345678901234567890</p>"

    const redacted = redactEmailHtml(html)

    expect(redacted).toBe(
      "<p>Welcome</p><input [redacted]>" + "<p>token=[redacted]</p>"
    )
    expect(redacted).not.toContain("correct-horse")
    expect(redacted).not.toContain("ghp_123456789012345678901234567890")
  })
})

describe("createEmailLog", () => {
  beforeEach(() => {
    mockMethods.emailLog.create.mockClear()
    mockMethods.emailLog.create.mockResolvedValue({ id: "log-1" })
  })

  it("persists optional metadata and redacts rendered credentials", async () => {
    const bodyHtml =
      "<input password=correct-horse>" +
      "<p>token=ghp_123456789012345678901234567890</p>"

    const result = await createEmailLog({
      recipientEmail: "user@example.com",
      type: "TICKET_CREATED",
      subject: "Your ticket was created",
      bodyHtml,
      ticketId: "ticket-1",
      ticketNumber: "TKT-001",
      organizationId: "org-1",
      relatedEntityType: "support_ticket",
      relatedEntityId: "ticket-1",
    })

    expect(result).toBe("log-1")
    expect(mockMethods.emailLog.create).toHaveBeenCalledWith({
      data: {
        recipientEmail: "user@example.com",
        type: "TICKET_CREATED",
        subject: "Your ticket was created",
        bodyHtml: "<input [redacted]><p>token=[redacted]</p>",
        status: "QUEUED",
        ticketId: "ticket-1",
        ticketNumber: "TKT-001",
        organizationId: "org-1",
        relatedEntityType: "support_ticket",
        relatedEntityId: "ticket-1",
      },
    })
  })

  it("returns null when Prisma create fails", async () => {
    mockMethods.emailLog.create.mockRejectedValue(new Error("db down"))
    const consoleSpy = spyOn(console, "error").mockImplementation(() => {})

    try {
      const result = await createEmailLog({
        recipientEmail: "user@example.com",
        type: "TICKET_CREATED",
        subject: "Your ticket was created",
        bodyHtml: "<p>Hello</p>",
      })

      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        "[EmailLog] Failed to create email log:",
        expect.any(Error)
      )
    } finally {
      consoleSpy.mockRestore()
    }
  })
})
