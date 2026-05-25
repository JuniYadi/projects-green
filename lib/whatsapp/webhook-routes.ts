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

export const whatsappWebhookRoutes = new Elysia({ tag: "WhatsApp Webhook" })
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
    const rawBody = body instanceof Uint8Array
      ? new TextDecoder().decode(body)
      : JSON.stringify(body)

    const signature = request.headers.get("x-hub-signature-256") || ""
    const isValid = verifySignature(rawBody, signature)
    if (!isValid) {
      set.status = 403
      return { error: "Invalid signature" }
    }

    // TODO (PGREEN-008): dispatch to BullMQ job queue
    return { ok: true }
  })