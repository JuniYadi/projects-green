/**
 * WhatsApp webhook handler — verify + process incoming events.
 *
 * GET  /api/whatsapp/webhook → Meta webhook verification (challenge)
 * POST /api/whatsapp/webhook → Receive and verify event payloads
 *
 * Both endpoints are intentionally unauthenticated (Meta calls them).
 * HMAC signature validation on POST ensures payload integrity.
 */

import { Elysia } from "elysia"
import { verifySignature } from "./webhook"
import { verifyWebhookUseCase } from "./verify-webhook"
import { handleEventUseCase } from "./handle-event"
import { enqueueWhatsAppWebhook } from "@/lib/queue/whatsapp-webhook"
import { webhookMetrics } from "@/modules/health/webhook-metrics.service"
import { prisma } from "@/lib/prisma"
import { createWebhookEvent } from "@/modules/whatsapp/webhooks/webhooks.service"

export const whatsappWebhookRoutes = new Elysia({ tags: ["WhatsApp Webhook"] })
  // Meta sends GET to verify webhook ownership
  .get("/whatsapp/webhook", ({ query }) => {
    const result = verifyWebhookUseCase({
      mode: query.mode as string,
      token: query.token as string,
      challenge: query["hub.challenge"] as string,
    })

    if (!result.ok) return result.challenge as unknown as undefined

    return new Response(result.challenge, { status: 200 })
  })
  // Receive webhook events from Meta
  .post("/whatsapp/webhook", async ({ body, set, request }) => {
    webhookMetrics.incrementTotalRequests()

    const rawBody =
      body instanceof Uint8Array
        ? new TextDecoder().decode(body)
        : JSON.stringify(body)

    const signature = request.headers.get("x-hub-signature-256") || ""
    const isValid = verifySignature(rawBody, signature)
    if (!isValid) {
      webhookMetrics.incrementHmacFailures()
      set.status = 403
      return { error: "Invalid signature" }
    }

    // Respond 200 to Meta immediately — processing happens async via BullMQ
    void dispatchWebhookEvents(body, rawBody).catch((err) => {
      webhookMetrics.incrementProcessingErrors()
      console.error("[whatsapp-webhook] dispatch error:", err)
    })

    return { ok: true }
  })

/**
 * Look up a WhatsApp device by its Meta phone_number_id (whatsappPhoneId).
 */
async function lookupDeviceByPhoneId(phoneNumberId: string) {
  if (!phoneNumberId) return null
  return prisma.whatsappDevice.findFirst({
    where: { whatsappPhoneId: phoneNumberId },
    select: { id: true, organizationId: true },
  })
}

export async function dispatchWebhookEvents(body: unknown, rawBody?: string): Promise<void> {
  const result = await handleEventUseCase(body, { rawBody })

  // Handle duplicate events first (no code property)
  if (result && "duplicate" in result && result.duplicate) {
    webhookMetrics.incrementDuplicateEvents()
    console.info("[whatsapp-webhook] duplicate event ignored")
    return
  }

  if (!result || !("code" in result)) {
    webhookMetrics.incrementProcessingErrors()
    console.warn("[whatsapp-webhook] unexpected handleEventUseCase result", result)
    return
  }

  if (result.code !== 200) {
    webhookMetrics.incrementProcessingErrors()
    console.warn("[whatsapp-webhook] invalid payload:", result.message)
    return
  }

  const entries = "entries" in result ? result.entries : []
  if (!entries || entries.length === 0) {
    console.info("[whatsapp-webhook] no entries to process")
    return
  }

  for (const entry of entries) {
    const phoneNumberId = entry.phoneNumberId

    // Look up device to capture webhook events
    const device = await lookupDeviceByPhoneId(phoneNumberId)

    // Enqueue each message event + create webhook event record
    for (const message of entry.messages) {
      try {
        await enqueueWhatsAppWebhook("message", message, phoneNumberId)
      } catch (err) {
        console.error(
          "[whatsapp-webhook] failed to enqueue message event",
          err,
        )
      }

      // Capture webhook event for this message
      if (device) {
        createWebhookEvent(
          device.organizationId,
          device.id,
          "inbound_message",
          message as any,
        ).catch((err) => console.error("[whatsapp-webhook] failed to create webhook event:", err))
      }
    }

    // Enqueue each status event + create webhook event record
    for (const status of entry.statuses) {
      try {
        await enqueueWhatsAppWebhook("statuses", status, phoneNumberId)
      } catch (err) {
        console.error(
          "[whatsapp-webhook] failed to enqueue status event",
          err,
        )
      }

      // Capture webhook event for this status
      if (device) {
        createWebhookEvent(
          device.organizationId,
          device.id,
          "status_update",
          status as any,
        ).catch((err) => console.error("[whatsapp-webhook] failed to create webhook event:", err))
      }
    }
  }
}
