/**
 * WhatsApp Webhook Dead Letter Service
 *
 * CRUD operations for failed webhook payloads that exceeded retry limit.
 */

import { prisma } from "@/lib/prisma"
import { WebhookRetryJob } from "../jobs/webhook-retry.job"

type CreateDeadLetterInput = {
  deviceId: string
  organizationId?: string
  eventType: string
  payload: unknown
  errorMessage: string
  attemptCount: number
}

export async function createDeadLetter(
  input: CreateDeadLetterInput
): Promise<{ id: string }> {
  const deadLetter = await prisma.whatsappWebhookDeadLetter.create({
    data: {
      deviceId: input.deviceId,
      organizationId: input.organizationId ?? null,
      eventType: input.eventType,
      rawPayload: input.payload as object,
      errorMessage: input.errorMessage,
      attemptCount: input.attemptCount,
    },
  })
  return { id: deadLetter.id }
}

type DeadLetterFilter = {
  organizationId?: string
  deviceId?: string
  eventType?: string
  replayStatus?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

type PaginatedDeadLetters = {
  data: Array<{
    id: string
    deviceId: string
    eventType: string
    rawPayload: object
    errorMessage: string
    attemptCount: number
    failedAt: Date
    replayedAt: Date | null
    replayStatus: string | null
  }>
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export async function listDeadLetters(
  filter: DeadLetterFilter
): Promise<PaginatedDeadLetters> {
  const { organizationId, deviceId, eventType, replayStatus, from, to, page = 1, limit = 20 } = filter

  const where: Record<string, unknown> = {}
  if (organizationId) where.organizationId = organizationId
  if (deviceId) where.deviceId = deviceId
  if (eventType) where.eventType = eventType
  if (replayStatus) where.replayStatus = replayStatus
  if (from || to) {
    where.failedAt = {}
    if (from) (where.failedAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.failedAt as Record<string, unknown>).lte = new Date(to)
  }

  const skip = (page - 1) * limit

  const [total, items] = await Promise.all([
    prisma.whatsappWebhookDeadLetter.count({ where }),
    prisma.whatsappWebhookDeadLetter.findMany({
      where,
      orderBy: { failedAt: "desc" },
      skip,
      take: limit,
    }),
  ])

  return {
    data: items.map((item) => ({
      id: item.id,
      deviceId: item.deviceId,
      eventType: item.eventType,
      rawPayload: item.rawPayload as object,
      errorMessage: item.errorMessage,
      attemptCount: item.attemptCount,
      failedAt: item.failedAt,
      replayedAt: item.replayedAt,
      replayStatus: item.replayStatus,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getDeadLetterById(id: string) {
  return prisma.whatsappWebhookDeadLetter.findUnique({ where: { id } })
}

export async function replayDeadLetter(id: string): Promise<void> {
  const deadLetter = await prisma.whatsappWebhookDeadLetter.findUnique({
    where: { id },
  })

  if (!deadLetter) {
    throw new Error("Dead letter not found")
  }

  await prisma.whatsappWebhookDeadLetter.update({
    where: { id },
    data: {
      replayStatus: "PENDING",
      replayedAt: new Date(),
    },
  })

  try {
    // Map "inbound_message"/"status_update" to "message"/"statuses"
    const jobEventType = deadLetter.eventType === "inbound_message"
      ? "message"
      : "statuses" as const
    await WebhookRetryJob.dispatch({
      eventId: `replay-${id}-${Date.now()}`,
      eventType: jobEventType,
      deviceId: deadLetter.deviceId,
      organizationId: deadLetter.organizationId ?? undefined,
      payload: deadLetter.rawPayload,
    })
  } catch (err) {
    await prisma.whatsappWebhookDeadLetter.update({
      where: { id },
      data: { replayStatus: "FAILED" },
    })
    throw err
  }

  await prisma.whatsappWebhookDeadLetter.update({
    where: { id },
    data: { replayStatus: "SUCCESS" },
  })
}
