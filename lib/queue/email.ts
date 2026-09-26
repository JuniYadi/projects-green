/**
 * Global Email Queue
 *
 * Single queue for ALL transactional emails (invoice, support, VPN).
 * Caller renders template + resolves recipient, sends pre-rendered HTML + subject.
 * Worker handles SMTP delivery with retries.
 *
 * ponytail: single queue, 1 worker, 1 throttle point — split per-module
 * if any module needs its own SMTP config or backoff policy.
 */

import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

import { BaseJob } from "@/lib/queue/base-job"
import { prisma } from "@/lib/prisma"

export type EmailJobData = {
  to: string
  subject: string
  html: string
  from?: string
  emailLogId?: string
  noticeAttempt?: number
}

export class EmailJob extends BaseJob {
  static readonly queue = "email"
  static readonly workerConcurrency = 2
  static readonly attempts = 3
  static readonly backoff = { type: "fixed" as const, delay: 10_000 }

  static async handle(job: { data: EmailJobData }): Promise<void> {
    const { to, subject, html, from } = job.data
    const emailLogId = job.data.emailLogId
    const noticeAttempt = job.data.noticeAttempt

    // A recovery job can coexist with the original BullMQ job. Only one
    // worker may move its generation into PROCESSING before calling SMTP.
    if (emailLogId && noticeAttempt !== undefined) {
      const claim = await prisma.emailLog.updateMany({
        where: {
          id: emailLogId,
          attempts: noticeAttempt,
          status: { in: ["QUEUED", "FAILED"] },
        },
        data: { status: "PROCESSING" },
      })
      if (claim.count === 0) return
    } else if (emailLogId) {
      const existing = await prisma.emailLog.findUnique({
        where: { id: emailLogId },
        select: { status: true },
      })
      if (existing?.status === "SENT") return
    }

    const transporter = createTransporter()
    const fromAddress = from ?? process.env.EMAIL_FROM ?? "noreply@yourapp.com"

    // Extract domain from "Name <email>" or bare "email" format
    const emailMatch = fromAddress.match(/<([^>]+)>/) ?? [null, fromAddress]
    const email = (emailMatch[1] ?? fromAddress).trim()
    const domain = email.split("@").pop() ?? ""
    if (domain === "yourapp.com" || domain.endsWith(".yourapp.com")) {
      throw new Error(
        "EMAIL_FROM is not configured or still contains the placeholder domain 'yourapp.com'. " +
          "Set EMAIL_FROM in your environment to a validated domain."
      )
    }

    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      })

      // Update email log status on success
      if (emailLogId) {
        const data = {
          status: "SENT" as const,
          sentAt: new Date(),
          providerMessageId:
            typeof info.messageId === "string" ? info.messageId : null,
        }
        await (
          noticeAttempt !== undefined
            ? prisma.emailLog.updateMany({
                where: {
                  id: emailLogId,
                  attempts: noticeAttempt,
                  status: "PROCESSING",
                },
                data,
              })
            : prisma.emailLog.update({
                where: { id: emailLogId },
                data: { ...data, attempts: { increment: 1 } },
              })
        ).catch((err) => {
          console.error("[EmailJob] Failed to update email log:", err)
        })
      }
    } catch (error) {
      // Update email log status on failure
      if (emailLogId) {
        const data = {
          status: "FAILED" as const,
          errorMessage: error instanceof Error ? error.message : String(error),
        }
        await (
          noticeAttempt !== undefined
            ? prisma.emailLog.updateMany({
                where: {
                  id: emailLogId,
                  attempts: noticeAttempt,
                  status: "PROCESSING",
                },
                data,
              })
            : prisma.emailLog.update({
                where: { id: emailLogId },
                data: { ...data, attempts: { increment: 1 } },
              })
        ).catch((err) => {
          console.error("[EmailJob] Failed to update email log:", err)
        })
      }
      throw error
    }
  }
}

function createTransporter(): Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

/**
 * Enqueue an email for async delivery.
 * Throws if the enqueue fails so callers can handle the error.
 *
 * Pass `opts.jobId` for a deterministic BullMQ job id so retries of the
 * same logical send (e.g. re-running after a crash) dedupe instead of
 * enqueueing a duplicate — BullMQ ignores `add()` of an existing jobId.
 */
export async function sendEmail(
  data: EmailJobData,
  opts?: { jobId?: string }
): Promise<string | null> {
  await EmailJob.enqueue(data, opts)
  return data.emailLogId ?? null
}
