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

export type EmailJobData = {
  to: string
  subject: string
  html: string
  from?: string
}

export class EmailJob extends BaseJob {
  static readonly queue = "email"
  static readonly workerConcurrency = 2
  static readonly attempts = 3
  static readonly backoff = { type: "fixed" as const, delay: 10_000 }

  static async handle(job: { data: EmailJobData }): Promise<void> {
    const { to, subject, html, from } = job.data
    const transporter = createTransporter()
    const fromAddress = from ?? process.env.EMAIL_FROM ?? "noreply@yourapp.com"

    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    })
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
 * Fire-and-forget: enqueue an email and log instead of throwing.
 * Never blocks the caller.
 */
export function sendEmail(data: EmailJobData): void {
  EmailJob.enqueue(data).catch((err) => {
    console.error(`[email-queue] failed to enqueue email to=${data.to}:`, err)
  })
}
