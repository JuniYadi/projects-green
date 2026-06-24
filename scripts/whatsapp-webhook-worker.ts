import { Worker, type Job } from "bullmq"

import {
  WHATSAPP_WEBHOOK_QUEUE_NAME,
  getWhatsAppWebhookRedisConnection,
  type WhatsAppWebhookJobData,
} from "@/lib/queue/whatsapp-webhook"
import {
  processInboundMessage,
  processDeliveryStatus,
} from "@/modules/whatsapp/webhooks/webhooks.service"
import { prisma } from "@/lib/prisma"

const redisConnection = getWhatsAppWebhookRedisConnection()

const worker = new Worker<WhatsAppWebhookJobData>(
  WHATSAPP_WEBHOOK_QUEUE_NAME,
  async (job: Job<WhatsAppWebhookJobData>) => {
    const { eventType, payload, deviceId, organizationId } = job.data

    // Validate organization ownership if organizationId is provided
    if (organizationId) {
      const deviceOrgId = await getDeviceOrganization(deviceId)
      if (!deviceOrgId) {
        console.warn(
          `[whatsapp-webhook-worker] device not found: ${deviceId}, skipping event`
        )
        return
      }
      if (deviceOrgId !== organizationId) {
        console.error(
          `[whatsapp-webhook-worker] organization mismatch: device=${deviceId} belongs to org=${deviceOrgId}, not org=${organizationId}`
        )
        return
      }
    }

    if (eventType === "message") {
      await handleMessageEvent(payload, deviceId)
      return
    }

    if (eventType === "statuses") {
      await handleStatusEvent(payload, deviceId)
      return
    }

    if (eventType === "error") {
      console.error(
        `[whatsapp-webhook-worker] error event for device=${deviceId}:`,
        payload
      )
      return
    }

    console.warn(`[whatsapp-webhook-worker] unknown event type: ${eventType}`)
  },
  {
    connection: redisConnection,
    concurrency: 4,
  }
)

async function getDeviceOrganization(deviceId: string): Promise<string | null> {
  const device = await prisma.whatsappDevice.findFirst({
    where: { id: deviceId },
    select: { id: true, organizationId: true },
  })

  return device?.organizationId ?? null
}

async function handleMessageEvent(
  payload: unknown,
  deviceId: string
): Promise<void> {
  const messagePayload = payload as Record<string, unknown>

  // Resolve organization from device
  const organizationId = await getDeviceOrganization(deviceId)

  if (!organizationId) {
    console.warn(
      `[whatsapp-webhook-worker] device not found: ${deviceId}, skipping message`
    )
    return
  }

  const from = messagePayload.from as string | undefined
  if (!from) {
    console.warn(
      `[whatsapp-webhook-worker] message missing 'from' field for device=${deviceId}`
    )
    return
  }

  try {
    const result = await processInboundMessage(
      messagePayload as any,
      deviceId,
      organizationId
    )

    console.info(
      `[whatsapp-webhook-worker] processed inbound message id=${result.messageId} conv=${result.conversationId} from=${from}${result.isNewConversation ? " (new conversation)" : ""}`
    )
  } catch (error) {
    console.error(
      `[whatsapp-webhook-worker] failed to process message from=${from} device=${deviceId}:`,
      error
    )
    throw error // Let BullMQ handle retry
  }
}

async function handleStatusEvent(
  payload: unknown,
  deviceId: string
): Promise<void> {
  const statusPayload = payload as Record<string, unknown>

  // Resolve organization from device
  const organizationId = await getDeviceOrganization(deviceId)

  if (!organizationId) {
    console.warn(
      `[whatsapp-webhook-worker] device not found: ${deviceId}, skipping status`
    )
    return
  }

  const waMessageId = statusPayload.id as string | undefined
  if (!waMessageId) {
    console.warn(
      `[whatsapp-webhook-worker] status missing 'id' field for device=${deviceId}`
    )
    return
  }

  try {
    const result = await processDeliveryStatus(
      statusPayload as any,
      deviceId,
      organizationId
    )

    if (result.messageId) {
      console.info(
        `[whatsapp-webhook-worker] status update: waMessageId=${waMessageId} status=${result.status} msgId=${result.messageId}`
      )
    } else {
      console.info(
        `[whatsapp-webhook-worker] status for unknown message: waMessageId=${waMessageId} status=${result.status}`
      )
    }
  } catch (error) {
    console.error(
      `[whatsapp-webhook-worker] failed to process status waMessageId=${waMessageId} device=${deviceId}:`,
      error
    )
    throw error // Let BullMQ handle retry
  }
}

worker.on("active", (job) => {
  console.info(
    `[whatsapp-webhook-worker] processing ${job.name} id=${job.id} eventType=${job.data.eventType}`
  )
})

worker.on("completed", (job) => {
  console.info(`[whatsapp-webhook-worker] completed ${job.name} id=${job.id}`)
})

worker.on("failed", async (job, error) => {
  if (!job) {
    console.error("[whatsapp-webhook-worker] failed job missing payload", error)
    return
  }

  const { eventType, payload, deviceId, organizationId } = job.data
  const attempts = job.attemptsMade ?? 0
  const maxAttempts = job.opts?.attempts ?? 3

  console.error(
    `[whatsapp-webhook-worker] failed ${job.name} id=${job.id} eventType=${eventType} deviceId=${deviceId} attempts=${attempts}`,
    error
  )

  // Mark event as dead-lettered when retries exhausted
  if (attempts >= maxAttempts) {
    try {
      await prisma.whatsappWebhookEvent.updateMany({
        where: {
          whatsappDeviceId: deviceId,
          processingStatus: "PENDING",
          eventType,
        },
        data: {
          processingStatus: "DEAD_LETTERED",
          errorMessage: toErrorMessage(error),
          processedAt: new Date(),
        },
      })

      console.info(
        `[whatsapp-webhook-worker] dead-lettered events for device=${deviceId} eventType=${eventType}`
      )
    } catch (dlqError) {
      console.error(
        `[whatsapp-webhook-worker] failed to update event status for device=${deviceId}:`,
        dlqError
      )
    }
  }
})

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return String(error)
}

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.info(`[whatsapp-webhook-worker] received ${signal}, shutting down`)

  try {
    await worker.close()
    process.exit(0)
  } catch (error) {
    console.error(
      "[whatsapp-webhook-worker] shutdown failed while closing worker",
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
