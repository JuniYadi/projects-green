import { Prisma } from "@prisma/client"
import { Queue, Worker, type Job } from "bullmq"

import { prisma } from "@/lib/prisma"
import {
  WHATSAPP_BROADCAST_JOB_NAME,
  WHATSAPP_BROADCAST_QUEUE_NAME,
  getWhatsAppBroadcastRedisConnection,
  type WhatsAppBroadcastJobData,
} from "@/lib/queue/whatsapp-broadcast"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"

const redisConnection = getWhatsAppBroadcastRedisConnection()
const broadcastQueue = new Queue<WhatsAppBroadcastJobData>(
  WHATSAPP_BROADCAST_QUEUE_NAME,
  { connection: redisConnection }
)

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown broadcast error"
}

function toTemplateFields(...values: unknown[]) {
  return values.flatMap((value) => {
    if (!value) {
      return []
    }

    if (Array.isArray(value)) {
      return value.map((item) => String(item))
    }

    if (typeof value === "object") {
      return Object.values(value as Record<string, unknown>).map((item) =>
        String(item)
      )
    }

    return [String(value)]
  })
}

async function enqueueBroadcastJob(
  data: WhatsAppBroadcastJobData,
  delay?: number
) {
  await broadcastQueue.add(WHATSAPP_BROADCAST_JOB_NAME, data, {
    delay,
    jobId: `wa-broadcast:${data.method}:${data.campaignId}:${data.recipientId}:${Date.now()}`,
    removeOnComplete: 500,
    removeOnFail: 500,
  })
}

async function updateCampaignStatus(campaignId: string) {
  const counts = await prisma.whatsappBroadcastRecipient.groupBy({
    by: ["status"],
    where: { broadcastId: campaignId },
    _count: { _all: true },
  })

  const countByStatus = new Map(
    counts.map((entry) => [entry.status, entry._count._all])
  )
  const queued = countByStatus.get("QUEUED") ?? 0
  const sent = countByStatus.get("SENT") ?? 0
  const failed = countByStatus.get("FAILED") ?? 0
  const processed = sent + failed
  const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
    where: { id: campaignId },
    select: { total: true },
  })

  if (!campaign) {
    return
  }

  await prisma.whatsappBroadcastCampaign.update({
    where: { id: campaignId },
    data: {
      queued,
      sent,
      failed,
      status:
        processed >= campaign.total
          ? failed > 0
            ? "COMPLETED_WITH_ERRORS"
            : "COMPLETED"
          : "PROCESSING",
      endedAt: processed >= campaign.total ? new Date() : undefined,
    },
  })
}

async function enforceThrottle(data: WhatsAppBroadcastJobData) {
  const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
    where: { id: data.campaignId },
    select: {
      organizationId: true,
      whatsappContactGroupId: true,
      whatsappDeviceId: true,
      throttleMaxMessages: true,
      throttlePerMinutes: true,
    },
  })

  if (!campaign?.whatsappContactGroupId) {
    return true
  }

  const maxMessages = campaign.throttleMaxMessages ?? 0
  const perMinutes = campaign.throttlePerMinutes ?? 0

  if (maxMessages <= 0 || perMinutes <= 0) {
    return true
  }

  const now = new Date()
  const windowMs = perMinutes * 60_000
  const state = await prisma.whatsappBroadcastRateState.findUnique({
    where: { whatsappContactGroupId: campaign.whatsappContactGroupId },
  })
  const windowStartAt = state?.windowStartAt ?? now
  const windowExpired = now.getTime() - windowStartAt.getTime() >= windowMs
  const messagesSentInWindow = windowExpired
    ? 0
    : state?.messagesSentInWindow ?? 0

  if (messagesSentInWindow >= maxMessages) {
    const delay = Math.max(
      windowMs - (now.getTime() - windowStartAt.getTime()),
      1_000
    )

    await enqueueBroadcastJob({ ...data, method: "throttle" }, delay)
    return false
  }

  await prisma.whatsappBroadcastRateState.upsert({
    where: { whatsappContactGroupId: campaign.whatsappContactGroupId },
    create: {
      organizationId: campaign.organizationId,
      whatsappContactGroupId: campaign.whatsappContactGroupId,
      whatsappDeviceId: campaign.whatsappDeviceId,
      windowStartAt: now,
      lastMessageSentAt: now,
      messagesSentInWindow: 1,
    },
    update: {
      whatsappDeviceId: campaign.whatsappDeviceId,
      windowStartAt: windowExpired ? now : windowStartAt,
      lastMessageSentAt: now,
      messagesSentInWindow: windowExpired
        ? 1
        : { increment: 1 },
    },
  })

  return true
}

async function dispatchBroadcast(
  data: WhatsAppBroadcastJobData,
  skipThrottle = false
) {
  const recipient = await prisma.whatsappBroadcastRecipient.findUnique({
    where: { id: data.recipientId },
    include: { broadcast: { include: { whatsappDevice: true } } },
  })

  if (!recipient || recipient.broadcastId !== data.campaignId) {
    throw new Error(`Broadcast recipient not found: ${data.recipientId}`)
  }

  if (recipient.status !== "QUEUED") {
    return
  }

  const campaign = recipient.broadcast
  const device = campaign.whatsappDevice

  try {
    if (!device?.tokenEncrypted || !device.whatsappPhoneId || !device.whatsappBusinessAccountId) {
      throw new Error(`Broadcast campaign is missing a configured WhatsApp device: ${campaign.id}`)
    }

    if (!skipThrottle) {
      const canSend = await enforceThrottle(data)
      if (!canSend) {
        return
      }
    }

    const client = await WhatsAppDeviceClient.fromDevice({
      accessToken: device.tokenEncrypted,
      phoneNumberId: device.whatsappPhoneId,
      wabaId: device.whatsappBusinessAccountId,
    })
    const fields = toTemplateFields(
      campaign.templateParams,
      recipient.dynamicValues
    )
    const result = await client.sendTemplateMessage({
      to: recipient.phoneNumber,
      templateName: campaign.templateName,
      templateLanguage: campaign.templateLanguage,
      fields,
    })
    const conversation = await prisma.whatsappConversation.upsert({
      where: {
        organizationId_contactPhone: {
          organizationId: campaign.organizationId,
          contactPhone: recipient.phoneNumber,
        },
      },
      create: {
        organizationId: campaign.organizationId,
        contactPhone: recipient.phoneNumber,
        whatsappDeviceId: campaign.whatsappDeviceId,
        lastDirection: "OUTBOX",
        lastMessageAt: new Date(),
      },
      update: {
        whatsappDeviceId: campaign.whatsappDeviceId,
        lastDirection: "OUTBOX",
        lastMessageAt: new Date(),
      },
    })

    await prisma.whatsappMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOX",
        messageType: "template",
        waMessageId: result.providerMessageId,
        metadata: {
          broadcastCampaignId: campaign.id,
          broadcastRecipientId: recipient.id,
          templateName: campaign.templateName,
          templateLanguage: campaign.templateLanguage,
          fields,
        } as Prisma.InputJsonValue,
        statusHistory: {
          create: {
            status: "SENT",
            timestamp: new Date(),
          },
        },
      },
    })

    await prisma.whatsappBroadcastRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "SENT",
        attempts: { increment: 1 },
        waMessageId: result.providerMessageId,
        lastError: null,
      },
    })
  } catch (error) {
    await prisma.whatsappBroadcastRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: getErrorMessage(error),
      },
    })
  }

  await updateCampaignStatus(data.campaignId)
}

async function throttleBroadcast(data: WhatsAppBroadcastJobData) {
  const canSend = await enforceThrottle(data)
  if (!canSend) {
    return
  }

  await dispatchBroadcast(data, true)
}

const worker = new Worker<WhatsAppBroadcastJobData>(
  WHATSAPP_BROADCAST_QUEUE_NAME,
  async (job: Job<WhatsAppBroadcastJobData>) => {
    if (job.data.method === "dispatch") {
      await dispatchBroadcast(job.data)
      return
    }

    if (job.data.method === "throttle") {
      await throttleBroadcast(job.data)
      return
    }

    if (job.data.method === "status-update") {
      await updateCampaignStatus(job.data.campaignId)
      return
    }
  },
  {
    connection: redisConnection,
    concurrency: 4,
  }
)

worker.on("active", (job) => {
  console.info(
    `[whatsapp-broadcast-worker] processing ${job.name} id=${job.id} campaign=${job.data.campaignId}`
  )
})

worker.on("completed", (job) => {
  console.info(
    `[whatsapp-broadcast-worker] completed ${job.name} id=${job.id}`
  )
})

worker.on("failed", (job, error) => {
  if (!job) {
    console.error(
      "[whatsapp-broadcast-worker] failed job missing payload",
      error
    )
    return
  }

  console.error(
    `[whatsapp-broadcast-worker] failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`,
    error
  )
})

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.info(`[whatsapp-broadcast-worker] received ${signal}, shutting down`)

  try {
    await worker.close()
    await broadcastQueue.close()
    process.exit(0)
  } catch (error) {
    console.error(
      "[whatsapp-broadcast-worker] shutdown failed while closing worker",
      error
    )
    process.exit(1)
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})
