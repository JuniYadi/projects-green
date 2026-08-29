import { Prisma, WhatsappBillingCategory } from "@prisma/client"
import { Queue, Worker, type Job } from "bullmq"

import { prisma } from "@/lib/prisma"
import {
  WHATSAPP_BROADCAST_JOB_NAME,
  WHATSAPP_BROADCAST_QUEUE_NAME,
  getWhatsAppBroadcastRedisConnection,
  type WhatsAppBroadcastJobData,
} from "@/lib/queue/whatsapp-broadcast"
import { logger } from "@/lib/logger"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import { upsertWhatsappContactFromMessage } from "@/modules/whatsapp/contacts/contacts.service"
import { resolveWhatsappQuotaCredit } from "@/modules/whatsapp/messages/quota-credit.service"
import { normalizeIndonesianPhoneNumber } from "@/modules/whatsapp/messages/phone-number"
import { renderTemplateBody } from "@/modules/whatsapp/templates/lib/template-renderer"
import {
  getHourlyMessageLimit,
  DEFAULT_DAILY_LIMIT_MESSAGE,
} from "@/modules/whatsapp/devices/devices.constants"
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
    jobId: `wa-broadcast_${data.method}_${data.campaignId}_${data.recipientId}_${Bun.randomUUIDv7()}`,
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
    : (state?.messagesSentInWindow ?? 0)

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
      messagesSentInWindow: windowExpired ? 1 : { increment: 1 },
    },
  })

  return true
}

async function enforceDeviceLimit(data: WhatsAppBroadcastJobData) {
  const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
    where: { id: data.campaignId },
    select: {
      organizationId: true,
      whatsappDeviceId: true,
    },
  })

  if (!campaign?.whatsappDeviceId) {
    return true
  }

  const device = await prisma.whatsappDevice.findUnique({
    where: { id: campaign.whatsappDeviceId },
    select: { dailyLimitMessage: true },
  })

  if (!device) {
    return true
  }

  const dailyLimit = device.dailyLimitMessage || DEFAULT_DAILY_LIMIT_MESSAGE
  const hourlyLimit = getHourlyMessageLimit(dailyLimit)

  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const hourStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours()
    )
  )

  const deviceId = campaign.whatsappDeviceId
  const orgId = campaign.organizationId

  const [dailyCount, hourlyCount] = await Promise.all([
    prisma.whatsappDailyCount.findUnique({
      where: {
        organizationId_date_whatsappDeviceId: {
          organizationId: orgId,
          date: today,
          whatsappDeviceId: deviceId,
        },
      },
      select: { messageOutboxCount: true },
    }),
    prisma.whatsappHourlyCount.findUnique({
      where: {
        organizationId_whatsappDeviceId_hour: {
          organizationId: orgId,
          whatsappDeviceId: deviceId,
          hour: hourStart,
        },
      },
      select: { messageOutboxCount: true },
    }),
  ])

  const dailyUsed = dailyCount?.messageOutboxCount ?? 0
  const hourlyUsed = hourlyCount?.messageOutboxCount ?? 0

  if (dailyUsed + 1 > dailyLimit) {
    const nextMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    )
    const delay = Math.max(nextMidnight.getTime() - now.getTime(), 1_000)
    await enqueueBroadcastJob({ ...data, method: "dispatch" }, delay)
    return false
  }

  if (hourlyUsed + 1 > hourlyLimit) {
    const nextHour = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours() + 1
      )
    )
    const delay = Math.max(nextHour.getTime() - now.getTime(), 1_000)
    await enqueueBroadcastJob({ ...data, method: "dispatch" }, delay)
    return false
  }

  // Increment both counters in a transaction before sending (atomic reservation)
  await prisma.$transaction([
    prisma.whatsappDailyCount.upsert({
      where: {
        organizationId_date_whatsappDeviceId: {
          organizationId: orgId,
          date: today,
          whatsappDeviceId: deviceId,
        },
      },
      update: { messageOutboxCount: { increment: 1 } },
      create: {
        organizationId: orgId,
        date: today,
        whatsappDeviceId: deviceId,
        messageOutboxCount: 1,
      },
    }),
    prisma.whatsappHourlyCount.upsert({
      where: {
        organizationId_whatsappDeviceId_hour: {
          organizationId: orgId,
          whatsappDeviceId: deviceId,
          hour: hourStart,
        },
      },
      update: { messageOutboxCount: { increment: 1 } },
      create: {
        organizationId: orgId,
        whatsappDeviceId: deviceId,
        hour: hourStart,
        messageOutboxCount: 1,
      },
    }),
  ])

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
    if (
      !device?.tokenEncrypted ||
      !device.whatsappPhoneId ||
      !device.whatsappBusinessAccountId
    ) {
      throw new Error(
        `Broadcast campaign is missing a configured WhatsApp device: ${campaign.id}`
      )
    }

    if (!skipThrottle) {
      const canSend = await enforceThrottle(data)
      if (!canSend) {
        return
      }
    }

    const canSendDevice = await enforceDeviceLimit(data)
    if (!canSendDevice) {
      return
    }

    const client = await WhatsAppDeviceClient.fromDevice({
      accessToken: device.tokenEncrypted,
      phoneNumberId: device.whatsappPhoneId,
      wabaId: device.whatsappBusinessAccountId,
      organizationId: campaign.organizationId,
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
    const normalizedPhone =
      normalizeIndonesianPhoneNumber(recipient.phoneNumber) ??
      recipient.phoneNumber

    // Find template to get language content for the rendered message and billing category
    let templateBody: string | null = null
    let templateCategory: string | null = null
    let templateLanguageData: Record<string, unknown> | null = null
    try {
      const tpl = await prisma.whatsappTemplate.findFirst({
        where: {
          OR: [
            { slug: campaign.templateName },
            { name: campaign.templateName },
          ],
          organizationId: campaign.organizationId,
        },
        select: {
          category: true,
          languages: {
            where: { lang: campaign.templateLanguage },
            select: {
              headerType: true,
              headerText: true,
              headerUrl: true,
              body: true,
              footer: true,
              buttons: true,
              parameters: true,
            },
            take: 1,
          },
        },
      })
      templateCategory = tpl?.category ?? null
      templateLanguageData =
        (tpl?.languages[0] as Record<string, unknown>) ?? null
      templateBody =
        typeof templateLanguageData?.body === "string"
          ? templateLanguageData.body
          : null
    } catch {
      // Non-critical
    }

    let renderedBody: string | null = templateBody
    if (templateBody && fields.length > 0) {
      const values: Record<number, string> = {}
      fields.forEach((f, i) => {
        values[i + 1] = f
      })
      renderedBody = renderTemplateBody(templateBody, values)
    }

    const conversation = await prisma.whatsappConversation.upsert({
      where: {
        organizationId_contactPhone: {
          organizationId: campaign.organizationId,
          contactPhone: normalizedPhone,
        },
      },
      create: {
        organizationId: campaign.organizationId,
        contactPhone: normalizedPhone,
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
        body: renderedBody ?? null,
        waMessageId: result.providerMessageId,
        metadata: {
          broadcastCampaignId: campaign.id,
          broadcastRecipientId: recipient.id,
          templateName: campaign.templateName,
          templateLanguage: campaign.templateLanguage,
          fields,
          templateLanguageData: templateLanguageData as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
        statusHistory: {
          create: {
            status: "SENT",
            timestamp: new Date(),
          },
        },
      },
    })

    // Upsert contact from this broadcast send — has provider message id, mark as WhatsApp active
    await upsertWhatsappContactFromMessage({
      organizationId: campaign.organizationId,
      phoneNumber: normalizedPhone,
      whatsappDeviceId: device.id,
      messageAt: new Date(),
      isWhatsapp: true,
      waId: result.providerMessageId,
      markChecked: true,
    })

    const _now = new Date()
    const _year = _now.getUTCFullYear()
    const _month = _now.getUTCMonth() + 1

    const deviceIdStr =
      campaign.whatsappDeviceId ?? `org-${campaign.organizationId}`

    // Resolve quota credit: use template category or default to UTILITY
    const resolvedCategory =
      (templateCategory as WhatsappBillingCategory) ??
      WhatsappBillingCategory.UTILITY
    const quotaCredit = await resolveWhatsappQuotaCredit({
      category: resolvedCategory,
      phoneNumber: recipient.phoneNumber,
    })
    await Promise.all([
      prisma.whatsappMonthlyCount.upsert({
        where: {
          organizationId_year_month_whatsappDeviceId: {
            organizationId: campaign.organizationId,
            year: _year,
            month: _month,
            whatsappDeviceId: deviceIdStr,
          },
        },
        update: { messageOutboxCount: { increment: 1 } },
        create: {
          organizationId: campaign.organizationId,
          year: _year,
          month: _month,
          whatsappDeviceId: deviceIdStr,
          messageOutboxCount: 1,
        },
      }),
      prisma.whatsappBillingLedger.create({
        data: {
          organizationId: campaign.organizationId,
          waMessageId: result.providerMessageId,
          phoneNumber: recipient.phoneNumber,
          category: quotaCredit.category,
          quotaKey: device.id,
          quotaValue: quotaCredit.quotaCredit,
          whatsappDeviceId: device.id,
        },
      }),
    ])

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

export async function processWhatsAppBroadcastJob(
  job: Job<WhatsAppBroadcastJobData>
) {
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
  }
}

const isUnifiedWorker = process.argv[1]?.endsWith("scripts/workers.ts")
const worker =
  isUnifiedWorker || process.env.UNIFIED_WORKER_PROCESS === "true"
    ? null
    : new Worker<WhatsAppBroadcastJobData>(
        WHATSAPP_BROADCAST_QUEUE_NAME,
        processWhatsAppBroadcastJob,
        {
          connection: redisConnection,
          concurrency: 4,
        }
      )
if (worker) {
  worker.on("active", (job) => {
    logger.info(
      {
        event: "worker.job.active",
        workerName: "whatsapp-broadcast",
        jobName: job.name,
        jobId: job.id,
        campaignId: job.data.campaignId,
      },
      `processing ${job.name} id=${job.id} campaign=${job.data.campaignId}`
    )
  })

  worker.on("completed", (job) => {
    logger.info(
      {
        event: "worker.job.completed",
        workerName: "whatsapp-broadcast",
        jobName: job.name,
        jobId: job.id,
      },
      `completed ${job.name} id=${job.id}`
    )
  })

  worker.on("failed", (job, error) => {
    if (!job) {
      logger.error(
        {
          event: "worker.job.failed",
          workerName: "whatsapp-broadcast",
          err: error,
        },
        "failed job missing payload"
      )
      return
    }

    logger.error(
      {
        event: "worker.job.failed",
        workerName: "whatsapp-broadcast",
        jobName: job.name,
        jobId: job.id,
        attempts: job.attemptsMade,
        err: error,
      },
      `failed ${job.name} id=${job.id} attempts=${job.attemptsMade}`
    )
  })
}

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown || !worker) {
    return
  }

  shuttingDown = true
  logger.info(
    {
      event: "worker.shutdown.started",
      workerName: "whatsapp-broadcast",
      signal,
    },
    `received ${signal}, shutting down`
  )
  try {
    await worker.close()
    await broadcastQueue.close()
  } catch (error) {
    logger.error(
      {
        event: "worker.shutdown.failed",
        workerName: "whatsapp-broadcast",
        err: error,
      },
      "shutdown failed while closing worker"
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
