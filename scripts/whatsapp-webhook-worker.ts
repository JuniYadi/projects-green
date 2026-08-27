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
import { createDeadLetter } from "@/modules/whatsapp/webhooks/services/webhook-dead-letter.service"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

const redisConnection = getWhatsAppWebhookRedisConnection()

const worker = new Worker<WhatsAppWebhookJobData>(
  WHATSAPP_WEBHOOK_QUEUE_NAME,
  async (job: Job<WhatsAppWebhookJobData>) => {
    const { eventType, payload, deviceId, organizationId } = job.data

    // Validate organization ownership if organizationId is provided
    if (organizationId) {
      const deviceOrgId = await getDeviceOrganization(deviceId)
      if (!deviceOrgId) {
        logger.warn(
          {
            event: "whatsapp.webhook.device_not_found",
            deviceId,
          },
          `device not found: ${deviceId}, skipping event`
        )
        return
      }
      if (deviceOrgId !== organizationId) {
        logger.error(
          {
            event: "whatsapp.webhook.organization_mismatch",
            deviceId,
            deviceOrgId,
            organizationId,
          },
          `organization mismatch: device=${deviceId} belongs to org=${deviceOrgId}, not org=${organizationId}`
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
      logger.error(
        {
          event: "whatsapp.webhook.error_event",
          deviceId,
          payload,
        },
        `error event for device=${deviceId}`
      )
      return
    }

    logger.warn(
      {
        event: "whatsapp.webhook.unknown_event_type",
        eventType: String(eventType),
        deviceId,
      },
      `unknown event type: ${String(eventType)}`
    )
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
    logger.warn(
      {
        event: "whatsapp.webhook.device_not_found",
        deviceId,
      },
      `device not found: ${deviceId}, skipping message`
    )
    return
  }

  const from = messagePayload.from as string | undefined
  if (!from) {
    logger.warn(
      {
        event: "whatsapp.webhook.missing_from_field",
        deviceId,
      },
      `message missing 'from' field for device=${deviceId}`
    )
    return
  }

  try {
    const result = await processInboundMessage(
      messagePayload as any,
      deviceId,
      organizationId
    )

    logger.info(
      {
        event: "whatsapp.webhook.message_processed",
        messageId: result.messageId,
        conversationId: result.conversationId,
        from,
        deviceId,
        isNewConversation: result.isNewConversation,
      },
      `processed inbound message id=${result.messageId} conv=${result.conversationId} from=${from}${result.isNewConversation ? " (new conversation)" : ""}`
    )
  } catch (error) {
    logger.error(
      {
        event: "whatsapp.webhook.message_processing_failed",
        from,
        deviceId,
        err: error,
      },
      `failed to process message from=${from} device=${deviceId}`
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
    logger.warn(
      {
        event: "whatsapp.webhook.device_not_found",
        deviceId,
      },
      `device not found: ${deviceId}, skipping status`
    )
    return
  }

  const waMessageId = statusPayload.id as string | undefined
  if (!waMessageId) {
    logger.warn(
      {
        event: "whatsapp.webhook.missing_status_id",
        deviceId,
      },
      `status missing 'id' field for device=${deviceId}`
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
      logger.info(
        {
          event: "whatsapp.webhook.status_updated",
          waMessageId,
          status: result.status,
          messageId: result.messageId,
          deviceId,
        },
        `status update: waMessageId=${waMessageId} status=${result.status} msgId=${result.messageId}`
      )
    } else {
      logger.info(
        {
          event: "whatsapp.webhook.status_unknown_message",
          waMessageId,
          status: result.status,
          deviceId,
        },
        `status for unknown message: waMessageId=${waMessageId} status=${result.status}`
      )
    }
  } catch (error) {
    logger.error(
      {
        event: "whatsapp.webhook.status_processing_failed",
        waMessageId,
        deviceId,
        err: error,
      },
      `failed to process status waMessageId=${waMessageId} device=${deviceId}`
    )
    throw error // Let BullMQ handle retry
  }
}

worker.on("active", (job) => {
  logger.info(
    {
      event: "worker.job.active",
      workerName: "whatsapp-webhook",
      jobName: job.name,
      jobId: job.id,
      eventType: job.data.eventType,
    },
    `processing ${job.name} id=${job.id} eventType=${job.data.eventType}`
  )
})

worker.on("completed", (job) => {
  logger.info(
    {
      event: "worker.job.completed",
      workerName: "whatsapp-webhook",
      jobName: job.name,
      jobId: job.id,
    },
    `completed ${job.name} id=${job.id}`
  )
})

worker.on("failed", async (job, error) => {
  if (!job) {
    logger.error(
      {
        event: "worker.job.failed",
        workerName: "whatsapp-webhook",
        err: error,
      },
      "failed job missing payload"
    )
    return
  }

  const { eventType, deviceId } = job.data
  const attempts = job.attemptsMade ?? 0
  const maxAttempts = job.opts?.attempts ?? 3

  logger.error(
    {
      event: "worker.job.failed",
      workerName: "whatsapp-webhook",
      jobName: job.name,
      jobId: job.id,
      eventType,
      deviceId,
      attempts,
      err: error,
    },
    `failed ${job.name} id=${job.id} eventType=${eventType} deviceId=${deviceId} attempts=${attempts}`
  )

  // Store in dead-letter queue when retries exhausted
  if (attempts >= maxAttempts) {
    try {
      await createDeadLetter({
        deviceId,
        eventType,
        payload: job.data,
        errorMessage: toErrorMessage(error),
        attemptCount: attempts,
      })

      logger.info(
        {
          event: "whatsapp.webhook.dead_letter_stored",
          deviceId,
          eventType,
        },
        `stored dead-letter for device=${deviceId} eventType=${eventType}`
      )
    } catch (dlqError) {
      logger.error(
        {
          event: "whatsapp.webhook.dead_letter_failed",
          deviceId,
          eventType,
          err: dlqError,
        },
        `failed to create dead-letter for device=${deviceId}`
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
  logger.info(
    {
      event: "worker.shutdown.started",
      workerName: "whatsapp-webhook",
      signal,
    },
    `received ${signal}, shutting down`
  )

  try {
    await worker.close()
    process.exit(0)
  } catch (error) {
    logger.error(
      {
        event: "worker.shutdown.failed",
        workerName: "whatsapp-webhook",
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
