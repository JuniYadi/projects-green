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

// ── Mock prisma ───────────────────────────────────────────────────────────
const mockEmailLogFindUnique = mock(
  async (_args?: unknown): Promise<{ status: string } | null> => null
)
const mockEmailLogUpdate = mock(async (_args?: unknown) => ({}))
let noticeStatus = "QUEUED"
let noticeAttempt = 0
const mockEmailLogUpdateMany = mock(
  async (args: {
    where: { attempts: number; status: string | { in: string[] } }
    data: { status: string }
  }) => {
    const statuses =
      typeof args.where.status === "string"
        ? [args.where.status]
        : args.where.status.in
    if (
      args.where.attempts !== noticeAttempt ||
      !statuses.includes(noticeStatus)
    ) {
      return { count: 0 }
    }
    noticeStatus = args.data.status
    return { count: 1 }
  }
)
mock.module("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findUnique: mockEmailLogFindUnique,
      update: mockEmailLogUpdate,
      updateMany: mockEmailLogUpdateMany,
    },
  },
}))

describe("EmailJob", () => {
  beforeEach(() => {
    mockSendMail.mockClear()
    mockEmailLogFindUnique.mockClear()
    mockEmailLogUpdate.mockClear()
    mockEmailLogUpdateMany.mockClear()
    noticeStatus = "QUEUED"
    noticeAttempt = 0
    mockEmailLogFindUnique.mockImplementation(async () => null)
    mockEmailLogUpdate.mockImplementation(async () => ({}))
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

  it("skips sending when the email log is already SENT", async () => {
    mockEmailLogFindUnique.mockImplementationOnce(async () => ({
      status: "SENT",
    }))
    const { EmailJob } = await import("@/lib/queue/email")
    await EmailJob.handle({
      data: {
        to: "user@test.com",
        subject: "Test",
        html: "<p>Test</p>",
        emailLogId: "log-1",
      },
    } satisfies Pick<Job<EmailJobData>, "data">)

    expect(mockEmailLogFindUnique).toHaveBeenCalledWith({
      where: { id: "log-1" },
      select: { status: true },
    })
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it("sends when the email log exists but is not yet SENT", async () => {
    mockEmailLogFindUnique.mockImplementationOnce(async () => ({
      status: "QUEUED",
    }))
    const { EmailJob } = await import("@/lib/queue/email")
    await EmailJob.handle({
      data: {
        to: "user@test.com",
        subject: "Test",
        html: "<p>Test</p>",
        emailLogId: "log-2",
      },
    } satisfies Pick<Job<EmailJobData>, "data">)

    expect(mockSendMail).toHaveBeenCalledTimes(1)
    expect(mockEmailLogUpdate).toHaveBeenCalledWith({
      where: { id: "log-2" },
      data: expect.objectContaining({ status: "SENT" }),
    })
  })

  it("allows only one concurrent notice worker to send", async () => {
    const { EmailJob } = await import("@/lib/queue/email")
    const job = {
      data: {
        to: "admin@test.com",
        subject: "Top-up received",
        html: "<p>Paid</p>",
        emailLogId: "log-1",
        noticeAttempt: 0,
      },
    }

    await Promise.all([EmailJob.handle(job), EmailJob.handle(job)])

    expect(mockSendMail).toHaveBeenCalledTimes(1)
    expect(noticeStatus).toBe("SENT")
    expect(mockEmailLogUpdateMany).toHaveBeenCalledWith({
      where: { id: "log-1", attempts: 0, status: "PROCESSING" },
      data: expect.objectContaining({ status: "SENT" }),
    })
  })

  it("does not send an obsolete attempt after a recovery claim", async () => {
    noticeAttempt = 1
    const { EmailJob } = await import("@/lib/queue/email")
    await EmailJob.handle({
      data: {
        to: "admin@test.com",
        subject: "Top-up received",
        html: "<p>Paid</p>",
        emailLogId: "log-1",
        noticeAttempt: 0,
      },
    })

    expect(mockSendMail).not.toHaveBeenCalled()
  })

  it("allows a BullMQ retry after an SMTP failure", async () => {
    mockSendMail.mockRejectedValueOnce(new Error("SMTP down"))
    const { EmailJob } = await import("@/lib/queue/email")
    const job = {
      data: {
        to: "admin@test.com",
        subject: "Top-up received",
        html: "<p>Paid</p>",
        emailLogId: "log-1",
        noticeAttempt: 0,
      },
    }

    await expect(EmailJob.handle(job)).rejects.toThrow("SMTP down")
    expect(noticeStatus).toBe("FAILED")
    await EmailJob.handle(job)
    expect(noticeStatus).toBe("SENT")
    expect(mockSendMail).toHaveBeenCalledTimes(2)
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
