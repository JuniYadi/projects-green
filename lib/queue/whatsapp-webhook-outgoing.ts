import { getQueue } from "./queue-config"

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

  await queue.add(WHATSAPP_WEBHOOK_OUTGOING_JOB, data, {
    jobId: `wa-outgoing:${data.webhookId}:${data.eventType}:${data.eventId ?? "anon"}`,
  })
}
