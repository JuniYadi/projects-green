/**
 * WhatsApp Webhook Dead Letter Admin API
 *
 * Admin endpoints for viewing and replaying failed webhook payloads.
 */

import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import {
  listDeadLetters,
  getDeadLetterById,
  replayDeadLetter,
} from "../services/webhook-dead-letter.service"

export const webhookDeadLetterRoutes = new Elysia({
  prefix: "/whatsapp/webhooks/dead-letter",
  tags: ["WhatsApp Webhook"],
})

  // GET /whatsapp/webhooks/dead-letter — list dead letters (org-scoped)
  .get(
    "/",
    async ({ query, set }) => {
      const page = Math.max(Number(query.page) || 1, 1)
      const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)

      const result = await listDeadLetters({
        deviceId: query.deviceId,
        eventType: query.eventType,
        replayStatus: query.replayStatus,
        from: query.from,
        to: query.to,
        page,
        limit,
      })

      return { ok: true, data: result.data, meta: result.meta }
    },
    {
      query: t.Object({
        deviceId: t.Optional(t.String()),
        eventType: t.Optional(t.String()),
        replayStatus: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )

  // GET /whatsapp/webhooks/dead-letter/:id — get dead letter detail
  .get("/:id", async ({ params, set }) => {
    const deadLetter = await getDeadLetterById(params.id)

    if (!deadLetter) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Dead letter not found." }
    }

    return { ok: true, data: deadLetter }
  })

  // POST /whatsapp/webhooks/dead-letter/:id/replay — replay dead letter
  .post("/:id/replay", async ({ params, set }) => {
    const deadLetter = await getDeadLetterById(params.id)

    if (!deadLetter) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Dead letter not found." }
    }

    try {
      await replayDeadLetter(params.id)
      return { ok: true, message: "Dead letter re-enqueued for replay." }
    } catch (error) {
      set.status = 500
      return {
        ok: false,
        error: "REPLAY_FAILED",
        message: error instanceof Error ? error.message : "Replay failed",
      }
    }
  })
