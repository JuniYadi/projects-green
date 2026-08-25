/**
 * WhatsApp Webhook Retry Job
 *
 * Processes incoming WhatsApp webhook events with retry logic.
 * On final failure, stores payload in dead-letter queue for manual replay.
 */

import type { Job } from "bullmq"
import { prisma } from "@/lib/prisma"
import { BaseJob } from "@/lib/queue/base-job"
import {
  recordProcessingResult,
  processInboundMessage,
  processDeliveryStatus,
} from "../webhooks.service"
import { createDeadLetter } from "../services/webhook-dead-letter.service"
import { processTemplateStatusUpdate } from "../../templates/template-status-update.service"
import type { TemplateStatusUpdate } from "@/lib/whatsapp/handle-event"

export const WHATSAPP_WEBHOOK_RETRY_QUEUE = "whatsapp-webhook-retry"

type WebhookRetryJobData = {
  eventId: string
  eventType: "message" | "statuses" | "template_status_update"
  deviceId: string
  organizationId?: string
  payload: unknown
}

export class WebhookRetryJob extends BaseJob {
  static readonly queue = WHATSAPP_WEBHOOK_RETRY_QUEUE
  static readonly workerConcurrency = 4
  static readonly attempts = 3
  static readonly backoff = { type: "exponential" as const, delay: 60_000 }

  static async dispatch(data: WebhookRetryJobData): Promise<void> {
    const jobId = `wa-retry-${data.eventId}`
    await this.enqueue(data, { jobId })
  }

  static async handle(job: Job<WebhookRetryJobData>): Promise<void> {
    const { eventId, eventType, deviceId, payload } = job.data

    // Resolve organization from device
    const device = await prisma.whatsappDevice.findFirst({
      where: { id: deviceId },
      select: { organizationId: true },
    })

    if (!device) {
      throw new Error(`Device not found: ${deviceId}`)
    }

    const organizationId = device.organizationId

    try {
      if (eventType === "message") {
        const msgPayload = payload as Record<string, unknown>
        const from = msgPayload.from as string | undefined
        if (!from) {
          throw new Error("Message missing 'from' field")
        }
        await processInboundMessage(msgPayload as any, deviceId, organizationId)
      } else if (eventType === "statuses") {
        await processDeliveryStatus(payload as any, deviceId, organizationId)
      } else {
        await processTemplateStatusUpdate(
          organizationId,
          deviceId,
          payload as TemplateStatusUpdate
        )
      }
      await recordProcessingResult(eventId, "SUCCESS")
    } catch (error) {
      const maxAttempts =
        typeof job.opts.attempts === "number" ? job.opts.attempts : 3
      const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts

      if (isFinalAttempt) {
        await recordProcessingResult(eventId, "FAILED", String(error))
        await createDeadLetter({
          deviceId,
          organizationId,
          eventType:
            eventType === "message"
              ? "inbound_message"
              : eventType === "statuses"
                ? "status_update"
                : "template_status_update",
          payload,
          errorMessage: String(error),
          attemptCount: job.attemptsMade + 1,
        })
      }

      throw error
    }
  }
}
