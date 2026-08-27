import { Worker, type Job } from "bullmq"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { getRedisConnection } from "@/lib/queue/queue-config"
import {
  WHATSAPP_WEBHOOK_OUTGOING_QUEUE,
  type WhatsappOutgoingWebhookJobData,
} from "@/lib/queue/whatsapp-webhook-outgoing"
import { logger } from "@/lib/logger"

const redisConnection = getRedisConnection()

/**
 * Process an outgoing webhook delivery job.
 * Exported for use in the unified worker (scripts/workers.ts).
 */
export async function processOutgoingWebhookJob(
  job: Job<WhatsappOutgoingWebhookJobData>
): Promise<void> {
  const { webhookId, organizationId, deviceId, eventType, eventId, payload } =
    job.data

  // Read webhook config
  const webhook = await prisma.whatsappWebhook.findUnique({
    where: { id: webhookId },
  })

  if (!webhook) {
    logger.warn(
      {
        event: "whatsapp.webhook_outgoing.not_found",
        webhookId,
      },
      `webhook not found: ${webhookId}, skipping`
    )
    return
  }

  if (!webhook.active) {
    logger.info(
      {
        event: "whatsapp.webhook_outgoing.inactive",
        webhookId,
      },
      `webhook ${webhookId} is inactive, skipping`
    )
    return
  }

  const headers = buildHeaders(webhook)
  const requestHeaders: Record<string, string> = {}
  headers.forEach((value, key) => {
    requestHeaders[key] = value
  })

  const body = JSON.stringify(payload)
  let attempt = (job.attemptsMade ?? 0) + 1
  const maxAttempts = webhook.retryMaxAttempts

  // Check for existing delivery log
  let deliveryLogId: string | null = null
  const existing = await prisma.whatsappWebhookDeliveryLog.findFirst({
    where: { webhookId, triggerEventId: eventId, eventType },
    orderBy: { attempt: "desc" },
  })

  if (existing) {
    deliveryLogId = existing.id
    attempt = existing.attempt + 1
  }

  const startedAt = new Date()

  try {
    const response = await fetch(webhook.webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    })

    const responseBody = await response.text()

    if (response.ok) {
      // Success — record delivery log
      if (deliveryLogId) {
        await prisma.whatsappWebhookDeliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: "SUCCESS",
            attempt,
            requestUrl: webhook.webhookUrl,
            requestHeaders: requestHeaders as Prisma.InputJsonValue,
            requestBody: payload as Prisma.InputJsonValue,
            responseStatus: response.status,
            responseBody,
            errorMessage: null,
            completedAt: new Date(),
          },
        })
      } else {
        await prisma.whatsappWebhookDeliveryLog.create({
          data: {
            webhookId,
            organizationId,
            whatsappDeviceId: deviceId,
            eventType,
            triggerEventId: eventId,
            status: "SUCCESS",
            attempt,
            maxAttempts,
            requestUrl: webhook.webhookUrl,
            requestHeaders: requestHeaders as Prisma.InputJsonValue,
            requestBody: payload as Prisma.InputJsonValue,
            responseStatus: response.status,
            responseBody,
            startedAt,
            completedAt: new Date(),
          },
        })
      }

      logger.info(
        {
          event: "whatsapp.webhook_outgoing.delivered",
          webhookId,
          eventType,
          responseStatus: response.status,
        },
        `delivered webhook=${webhookId} event=${eventType} status=${response.status}`
      )
      return
    }

    // Non-ok response
    const errorMsg = `HTTP ${response.status}: ${responseBody.slice(0, 500)}`

    if (attempt >= maxAttempts) {
      // Exhausted — dead letter
      if (deliveryLogId) {
        await prisma.whatsappWebhookDeliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: "DEAD_LETTERED",
            attempt,
            requestUrl: webhook.webhookUrl,
            requestHeaders: requestHeaders as Prisma.InputJsonValue,
            requestBody: payload as Prisma.InputJsonValue,
            responseStatus: response.status,
            responseBody,
            errorMessage: errorMsg,
            completedAt: new Date(),
          },
        })
      } else {
        await prisma.whatsappWebhookDeliveryLog.create({
          data: {
            webhookId,
            organizationId,
            whatsappDeviceId: deviceId,
            eventType,
            triggerEventId: eventId,
            status: "DEAD_LETTERED",
            attempt,
            maxAttempts,
            requestUrl: webhook.webhookUrl,
            requestHeaders: requestHeaders as Prisma.InputJsonValue,
            requestBody: payload as Prisma.InputJsonValue,
            responseStatus: response.status,
            responseBody,
            errorMessage: errorMsg,
            startedAt,
            completedAt: new Date(),
          },
        })
      }

      logger.error(
        {
          event: "whatsapp.webhook_outgoing.dead_lettered",
          webhookId,
          eventType,
          attempts: attempt,
          errorMsg,
        },
        `dead-lettered webhook=${webhookId} event=${eventType} after ${attempt} attempts: ${errorMsg}`
      )
      return // don't re-throw — BullMQ should not retry
    }

    // Failed but can retry — update log and throw
    if (deliveryLogId) {
      await prisma.whatsappWebhookDeliveryLog.update({
        where: { id: deliveryLogId },
        data: {
          status: "FAILED",
          attempt,
          requestUrl: webhook.webhookUrl,
          requestHeaders: requestHeaders as Prisma.InputJsonValue,
          requestBody: payload as Prisma.InputJsonValue,
          responseStatus: response.status,
          responseBody,
          errorMessage: errorMsg,
        },
      })
    } else {
      await prisma.whatsappWebhookDeliveryLog.create({
        data: {
          webhookId,
          organizationId,
          whatsappDeviceId: deviceId,
          eventType,
          triggerEventId: eventId,
          status: "FAILED",
          attempt,
          maxAttempts,
          requestUrl: webhook.webhookUrl,
          requestHeaders: requestHeaders as Prisma.InputJsonValue,
          requestBody: payload as Prisma.InputJsonValue,
          responseStatus: response.status,
          responseBody,
          errorMessage: errorMsg,
          startedAt,
        },
      })
    }

    throw new Error(errorMsg)
  } catch (error) {
    // Network error or throw from above
    if (error instanceof Error && error.message.startsWith("HTTP")) {
      throw error // already handled above
    }

    const errorMsg = error instanceof Error ? error.message : String(error)

    if (attempt >= maxAttempts) {
      // Dead letter on network error after exhaustion
      if (deliveryLogId) {
        await prisma.whatsappWebhookDeliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: "DEAD_LETTERED",
            attempt,
            errorMessage: errorMsg,
            completedAt: new Date(),
          },
        })
      } else {
        await prisma.whatsappWebhookDeliveryLog.create({
          data: {
            webhookId,
            organizationId,
            whatsappDeviceId: deviceId,
            eventType,
            triggerEventId: eventId,
            status: "DEAD_LETTERED",
            attempt,
            maxAttempts,
            requestUrl: webhook.webhookUrl,
            requestHeaders: requestHeaders as Prisma.InputJsonValue,
            requestBody: payload as Prisma.InputJsonValue,
            errorMessage: errorMsg,
            startedAt,
            completedAt: new Date(),
          },
        })
      }

      logger.error(
        {
          event: "whatsapp.webhook_outgoing.dead_lettered",
          webhookId,
          eventType,
          attempts: attempt,
          reason: "network",
          errorMsg,
        },
        `dead-lettered webhook=${webhookId} event=${eventType} after ${attempt} attempts (network): ${errorMsg}`
      )
      return
    }

    // Record failure and throw for BullMQ retry
    if (deliveryLogId) {
      await prisma.whatsappWebhookDeliveryLog.update({
        where: { id: deliveryLogId },
        data: {
          status: "FAILED",
          attempt,
          errorMessage: errorMsg,
        },
      })
    } else {
      await prisma.whatsappWebhookDeliveryLog.create({
        data: {
          webhookId,
          organizationId,
          whatsappDeviceId: deviceId,
          eventType,
          triggerEventId: eventId,
          status: "FAILED",
          attempt,
          maxAttempts,
          requestUrl: webhook.webhookUrl,
          requestHeaders: requestHeaders as Prisma.InputJsonValue,
          requestBody: payload as Prisma.InputJsonValue,
          errorMessage: errorMsg,
          startedAt,
        },
      })
    }

    throw error
  }
}

/**
 * Construct an HTTP Headers object from the webhook's auth config.
 */
function buildHeaders(webhook: {
  authType: string | null
  authValue: string | null
  authHeaderName: string | null
}): Headers {
  const headers = new Headers()
  headers.set("Content-Type", "application/json")

  switch (webhook.authType) {
    case "bearer":
      headers.set("Authorization", `Bearer ${webhook.authValue ?? ""}`)
      break
    case "basic":
      headers.set(
        "Authorization",
        `Basic ${Buffer.from(webhook.authValue ?? "").toString("base64")}`
      )
      break
    case "custom-header":
      if (webhook.authHeaderName) {
        headers.set(webhook.authHeaderName, webhook.authValue ?? "")
      }
      break
    case "none":
    default:
      break
  }

  return headers
}

const worker = new Worker<WhatsappOutgoingWebhookJobData>(
  WHATSAPP_WEBHOOK_OUTGOING_QUEUE,
  processOutgoingWebhookJob,
  {
    connection: redisConnection,
    concurrency: 4,
  }
)

worker.on("active", (job) => {
  logger.info(
    {
      event: "worker.job.active",
      workerName: "whatsapp-webhook-outgoing",
      jobName: job.name,
      jobId: job.id,
      webhookId: job.data.webhookId,
      eventType: job.data.eventType,
    },
    `processing ${job.name} id=${job.id} webhook=${job.data.webhookId} event=${job.data.eventType}`
  )
})

worker.on("completed", (job) => {
  logger.info(
    {
      event: "worker.job.completed",
      workerName: "whatsapp-webhook-outgoing",
      jobName: job.name,
      jobId: job.id,
      webhookId: job.data.webhookId,
    },
    `completed ${job.name} id=${job.id} webhook=${job.data.webhookId}`
  )
})

worker.on("failed", (job, error) => {
  if (!job) {
    logger.error(
      {
        event: "worker.job.failed",
        workerName: "whatsapp-webhook-outgoing",
        err: error,
      },
      "failed job missing payload"
    )
    return
  }
  logger.error(
    {
      event: "worker.job.failed",
      workerName: "whatsapp-webhook-outgoing",
      jobName: job.name,
      jobId: job.id,
      webhookId: job.data.webhookId,
      attempts: job.attemptsMade,
      err: error,
    },
    `failed ${job.name} id=${job.id} webhook=${job.data.webhookId} attempts=${job.attemptsMade}`
  )
})

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) return
  shuttingDown = true
  logger.info(
    {
      event: "worker.shutdown.started",
      workerName: "whatsapp-webhook-outgoing",
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
        workerName: "whatsapp-webhook-outgoing",
        err: error,
      },
      "shutdown failed while closing worker"
    )
    process.exit(1)
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))

export default worker
