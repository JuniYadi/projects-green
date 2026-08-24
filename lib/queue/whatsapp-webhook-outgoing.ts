import { getQueue } from "@/lib/queue/queue-config"

export const WHATSAPP_WEBHOOK_OUTGOING_QUEUE = "whatsapp-webhook-outgoing"
export const WHATSAPP_WEBHOOK_OUTGOING_JOB = "webhook-dispatch"

export type WhatsappOutgoingWebhookJobData = {
  webhookId: string
  organizationId: string
  deviceId: string
  eventType: string
  eventId?: string
  payload: unknown
}

/**
 * Enqueue an outgoing webhook delivery job.
 */
export const enqueueOutgoingWebhook = async (
  data: WhatsappOutgoingWebhookJobData
) => {
  const queue = getQueue<WhatsappOutgoingWebhookJobData>(
    WHATSAPP_WEBHOOK_OUTGOING_QUEUE
  )

  const jobId = data.eventId
    ? `wa-outgoing_${data.webhookId}_${data.eventType}_${data.eventId}`
    : `wa-outgoing_${data.webhookId}_${data.eventType}_${Bun.randomUUIDv7()}`
  await queue.add(WHATSAPP_WEBHOOK_OUTGOING_JOB, data, {
    jobId,
  })
}
