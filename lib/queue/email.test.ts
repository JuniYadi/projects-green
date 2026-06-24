import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { Job } from "bullmq"
import type { EmailJobData } from "@/lib/queue/email"

// ── Mock nodemailer ───────────────────────────────────────────────────────
const mockSendMail = mock(async () => ({ messageId: "test-123" }))
mock.module("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: mockSendMail }),
  },
  createTransport: () => ({ sendMail: mockSendMail }),
}))

describe("EmailJob", () => {
  beforeEach(() => {
    mockSendMail.mockClear()
    process.env.SMTP_HOST = "smtp.test.com"
    process.env.SMTP_PORT = "587"
    process.env.SMTP_USER = "test@test.com"
    process.env.SMTP_PASS = "password"
    process.env.EMAIL_FROM = "Test <test@test.com>"
  })

  it("has expected queue config", async () => {
    const { EmailJob } = await import("@/lib/queue/email")
    expect(EmailJob.queue).toBe("email")
    expect(EmailJob.workerConcurrency).toBe(2)
    expect(EmailJob.attempts).toBe(3)
  })

  it("sends email via nodemailer in handle", async () => {
    const { EmailJob } = await import("@/lib/queue/email")
    await EmailJob.handle({
      data: {
        to: "user@test.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      },
    } satisfies Pick<Job<EmailJobData>, "data">)

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      })
    )
  })

  it("uses configured from address", async () => {
    const { EmailJob } = await import("@/lib/queue/email")
    await EmailJob.handle({
      data: {
        to: "user@test.com",
        subject: "Test",
        html: "<p>Test</p>",
      },
    } satisfies Pick<Job<EmailJobData>, "data">)

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Test <test@test.com>",
      })
    )
  })

  it("supports custom from address", async () => {
    const { EmailJob } = await import("@/lib/queue/email")
    await EmailJob.handle({
      data: {
        to: "user@test.com",
        subject: "Test",
        html: "<p>Test</p>",
        from: "Custom <custom@test.com>",
      },
    } satisfies Pick<Job<EmailJobData>, "data">)

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Custom <custom@test.com>",
      })
    )
  })
})

describe("sendEmail helper", () => {
  beforeEach(() => {
    mockSendMail.mockClear()
  })

  it("is a function", async () => {
    const { sendEmail } = await import("@/lib/queue/email")
    expect(typeof sendEmail).toBe("function")
  })
})
