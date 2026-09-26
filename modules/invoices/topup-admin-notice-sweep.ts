/**
 * Sweeps stranded TOPUP_RECEIVED_ADMIN_NOTICE EmailLog rows.
 *
 * The initial send (modules/invoices/email.service.tsx) claims a row
 * (eventKey `topup-admin:{invoiceId}`) before enqueueing. If the process
 * crashes between the claim and the enqueue, or the BullMQ job is lost,
 * the row is stuck QUEUED (or FAILED after a worker retry) forever. This
 * sweep finds those rows and re-enqueues them using the row's own
 * recipient/subject/html, so no template re-render or invoice lookup is
 * needed.
 */
import type { EmailLogStatus } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/queue/email"

const EVENT_KEY_PREFIX = "topup-admin:"
const STALE_AFTER_MS = 10 * 60 * 1000
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
// Counts every SMTP try, not every sweep: 3 initial job attempts + 3 sweeps x 3 retries each = 12.
const MAX_ATTEMPTS = 12
const BATCH_SIZE = 50
// Bumped onto a row's `attempts` once it has been logged as abandoned, so
// the abandonment query below never matches it again — the log fires once
// per row instead of every 10 minutes forever.
const ABANDONED_ATTEMPTS_MARKER = 1_000

const STRANDED_STATUSES: EmailLogStatus[] = ["QUEUED", "FAILED"]

export type SweepStrandedTopupAdminNoticesResult = {
  found: number
  reenqueued: number
  failed: number
  abandoned: number
}

export async function sweepStrandedTopupAdminNotices(
  now: Date = new Date()
): Promise<SweepStrandedTopupAdminNoticesResult> {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS)
  const createdAfter = new Date(now.getTime() - MAX_AGE_MS)

  const stranded = await prisma.emailLog.findMany({
    where: {
      eventKey: { startsWith: EVENT_KEY_PREFIX },
      status: { in: STRANDED_STATUSES },
      updatedAt: { lt: staleBefore },
      createdAt: { gt: createdAfter },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  })

  let reenqueued = 0
  let failed = 0

  for (const row of stranded) {
    try {
      // Increment attempts first and use the returned value for the job
      // id suffix, so a crash between these two steps still leaves the
      // row's attempts count accurate for the next sweep.
      const updated = await prisma.emailLog.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      })

      await sendEmail(
        {
          to: row.recipientEmail,
          subject: row.subject,
          html: row.bodyHtml ?? "",
          emailLogId: row.id,
        },
        { jobId: `topup-admin_${row.relatedEntityId}_r${updated.attempts}` }
      )
      reenqueued += 1
    } catch (error) {
      // One row's failure must never stop the rest of the batch.
      failed += 1
      console.error(
        {
          event: "topup_admin_notice.reenqueue_failed",
          emailLogId: row.id,
          relatedEntityId: row.relatedEntityId,
          err: error instanceof Error ? error.message : String(error),
        },
        `[topup-admin-notice-sweep] failed to re-enqueue emailLogId=${row.id}`
      )
    }
  }

  const abandoned = await abandonExhaustedNotices(staleBefore, createdAfter)

  return { found: stranded.length, reenqueued, failed, abandoned }
}

/**
 * Rows that hit the retry cap or aged past the 7-day window while still
 * not SENT get one structured `console.error` each, then have `attempts`
 * bumped past the cap so they are excluded from every future query here
 * and from the main sweep above.
 *
 * `updatedAt: { lt: staleBefore }` mirrors the main sweep's staleness gate
 * so a row isn't logged abandoned while its just-enqueued job may still
 * succeed.
 */
async function abandonExhaustedNotices(
  staleBefore: Date,
  createdAfter: Date
): Promise<number> {
  const candidates = await prisma.emailLog.findMany({
    where: {
      eventKey: { startsWith: EVENT_KEY_PREFIX },
      status: { in: STRANDED_STATUSES },
      attempts: { lt: ABANDONED_ATTEMPTS_MARKER },
      updatedAt: { lt: staleBefore },
      OR: [
        { attempts: { gte: MAX_ATTEMPTS } },
        { createdAt: { lte: createdAfter } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  })

  for (const row of candidates) {
    console.error(
      {
        event: "topup_admin_notice.abandoned",
        emailLogId: row.id,
        relatedEntityId: row.relatedEntityId,
        attempts: row.attempts,
        createdAt: row.createdAt,
      },
      `[topup-admin-notice-sweep] abandoning emailLogId=${row.id} after ${row.attempts} attempts`
    )

    await prisma.emailLog
      .update({
        where: { id: row.id },
        data: { attempts: ABANDONED_ATTEMPTS_MARKER },
      })
      .catch(() => {})
  }

  return candidates.length
}
