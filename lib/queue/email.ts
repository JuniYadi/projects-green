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
  ticketId?: string
  ticketNumber?: string
  emailLogId?: string
}

export class EmailJob extends BaseJob {
  static readonly queue = "email"
  static readonly workerConcurrency = 2
  static readonly attempts = 3
  static readonly backoff = { type: "fixed" as const, delay: 10_000 }

  static async handle(job: { data: EmailJobData }): Promise<void> {
    const { to, subject, html, from, emailLogId } = job.data
    const transporter = createTransporter()
    const fromAddress = from ?? process.env.EMAIL_FROM ?? "noreply@yourapp.com"

    try {
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      })

      // Update email log status on success
      if (emailLogId) {
        await prisma.emailLog.update({
          where: { id: emailLogId },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        }).catch((err) => {
          console.error("[EmailJob] Failed to update email log:", err)
        })
      }
    } catch (error) {
      // Update email log status on failure
      if (emailLogId) {
        await prisma.emailLog.update({
          where: { id: emailLogId },
          data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : String(error),
            attempts: { increment: 1 },
          },
        }).catch((err) => {
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
 */
export async function sendEmail(data: EmailJobData): Promise<string> {
  await EmailJob.enqueue(data)
  return data.emailLogId ?? ""
}
