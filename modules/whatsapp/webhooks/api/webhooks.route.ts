import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import {
  createWebhookEvent,
  handleIncomingWebhook,
  recordProcessingResult,
  listWebhookEvents,
} from "../webhooks.service"
import {
  webhookDispatcher,
  toDeliveryLogDTO,
} from "../webhook-dispatcher.service"

/**
 * Infer the webhook event type from the Meta payload structure.
 */
function determineEventType(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "entry" in payload &&
    Array.isArray((payload as Record<string, unknown>).entry)
  ) {
    const entry = (payload as Record<string, unknown>).entry as Record<
      string,
      unknown
    >[]
    const changes = entry[0]?.changes as Record<string, unknown>[] | undefined
    const value = changes?.[0]?.value as Record<string, unknown> | undefined

    if (
      value?.messages &&
      Array.isArray(value.messages) &&
      value.messages.length > 0
    ) {
      return "inbound_message"
    }
    if (
      value?.statuses &&
      Array.isArray(value.statuses) &&
      value.statuses.length > 0
    ) {
      return "status_update"
    }
  }
  return "unknown"
}

export const webhooksRoutes = new Elysia({ prefix: "/webhooks" })

  // GET /events — list ALL webhook events across all devices (org-scoped, paginated)
  .get(
    "/events",
    async ({ request, query, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      if (!whatsappAuth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Organization required." }
      }

      const page = Math.max(Number(query.page) || 1, 1)
      const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)

      const result = await listWebhookEvents({
        organizationId: whatsappAuth.organizationId as string,
        whatsappDeviceId: query.deviceId ?? undefined, // null/undefined = all devices
        eventType: query.type,
        processingStatus: query.status,
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
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )

  // GET / — list webhook configs (paginated)
  .get(
    "/",
    async ({ request, query, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const page = Number(query.page) || 1
      const limit = Number(query.limit) || 20
      const skip = (page - 1) * limit

      const where: any = {}
      if (query.organizationId) where.organizationId = query.organizationId
      if (query.deviceId) where.whatsappDeviceId = query.deviceId

      const [data, total] = await Promise.all([
        prisma.whatsappWebhook.findMany({
          where,
          take: limit,
          skip,
          orderBy: { createdAt: "desc" },
        }),
        prisma.whatsappWebhook.count({ where }),
      ])

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        organizationId: t.Optional(t.String()),
        deviceId: t.Optional(t.String()),
      }),
    }
  )

  // GET /:id — get single webhook config
  .get("/:id", async ({ request, params, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const webhook = await prisma.whatsappWebhook.findUnique({
      where: { id: params.id },
    })
    if (!webhook) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
    }

    if (
      (whatsappAuth as any).platformRole !== "super_admin" &&
      webhook.organizationId !== whatsappAuth.organizationId
    ) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    return webhook
  })

  // POST / — create webhook config
  .post(
    "/",
    async ({ request, body, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!whatsappAuth.organizationId) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Organization ID required.",
        }
      }
      const webhook = await prisma.whatsappWebhook.create({
        data: {
          whatsappDeviceId: body.deviceId,
          organizationId: whatsappAuth.organizationId,
          webhookUrl: body.webhookUrl,
          verifyToken: body.verifyToken ?? null,
          authType: body.authType ?? "none",
          authValue: body.authValue ?? null,
          authHeaderName: body.authHeaderName ?? null,
          retryMaxAttempts: body.retryMaxAttempts ?? 3,
          retryIntervalMs: body.retryIntervalMs ?? 5000,
          active: true,
        },
      })
      return { ok: true, data: webhook }
    },
    {
      body: t.Object({
        deviceId: t.String(),
        webhookUrl: t.String(),
        verifyToken: t.Optional(t.String()),
        authType: t.Optional(t.Union([
          t.Literal("bearer"),
          t.Literal("basic"),
          t.Literal("custom-header"),
          t.Literal("none"),
        ])),
        authValue: t.Optional(t.String()),
        authHeaderName: t.Optional(t.String()),
        retryMaxAttempts: t.Optional(t.Number()),
        retryIntervalMs: t.Optional(t.Number()),
      }),
    }
  )

  // PATCH /:id — update webhook config
  .patch(
    "/:id",
    async ({ request, params, body, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const webhook = await prisma.whatsappWebhook.findUnique({
        where: { id: params.id },
      })
      if (!webhook) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        webhook.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      const updated = await prisma.whatsappWebhook.update({
        where: { id: params.id },
        data: body,
      })
      return { ok: true, data: updated }
    },
    {
      body: t.Partial(
        t.Object({
          webhookUrl: t.String(),
          verifyToken: t.String(),
          active: t.Boolean(),
          authType: t.Union([
            t.Literal("bearer"),
            t.Literal("basic"),
            t.Literal("custom-header"),
            t.Literal("none"),
          ]),
          authValue: t.String(),
          authHeaderName: t.String(),
          retryMaxAttempts: t.Number(),
          retryIntervalMs: t.Number(),
        })
      ),
    }
  )

  // DELETE /:id — delete webhook config
  .delete("/:id", async ({ request, params, set }: any) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const webhook = await prisma.whatsappWebhook.findUnique({
      where: { id: params.id },
    })
    if (!webhook) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
    }

    if (
      (whatsappAuth as any).platformRole !== "super_admin" &&
      webhook.organizationId !== whatsappAuth.organizationId
    ) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    await prisma.whatsappWebhook.delete({ where: { id: params.id } })
    return { ok: true }
  })

  // GET /:id/deliveries — paginated delivery logs (org-scoped)
  .get(
    "/:id/deliveries",
    async ({ request, params, query, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      const webhook = await prisma.whatsappWebhook.findUnique({
        where: { id: params.id },
        select: { organizationId: true },
      })

      if (!webhook) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        webhook.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      const result = await webhookDispatcher.getDeliveryLogs(params.id, {
        eventType: query.eventType,
        status: query.status,
        from: query.from,
        to: query.to,
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
      })

      return { ok: true, data: result.data, meta: result.meta }
    },
    {
      query: t.Object({
        eventType: t.Optional(t.String()),
        status: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )

  // POST /:id/deliveries/:deliveryId/resend — manual resend (org-scoped)
  .post(
    "/:id/deliveries/:deliveryId/resend",
    async ({ request, params, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      const deliveryLog =
        await prisma.whatsappWebhookDeliveryLog.findUnique({
          where: { id: params.deliveryId },
          select: {
            webhookId: true,
            organizationId: true,
          },
        })

      if (!deliveryLog || deliveryLog.webhookId !== params.id) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Delivery log not found." }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        deliveryLog.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      await webhookDispatcher.resendDelivery(params.deliveryId)
      return { ok: true, message: "Delivery re-enqueued for resend." }
    }
  )

  // POST /:id/test — send a test ping (org-scoped)
  .post(
    "/:id/test",
    async ({ request, params, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      const webhook = await prisma.whatsappWebhook.findUnique({
        where: { id: params.id },
        select: { organizationId: true },
      })

      if (!webhook) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        webhook.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      await webhookDispatcher.dispatch(
        params.id,
        "test",
        { test: true, timestamp: new Date().toISOString() }
      )

      return { ok: true, message: "Test webhook enqueued." }
    }
  )

  // GET /:id/verify — Meta webhook verification endpoint
  .get(
    "/:id/verify",
    async ({ params, query }: any) => {
      const mode = query["hub.mode"]
      const challenge = query["hub.challenge"]

      if (mode === "subscribe" && challenge) {
        return new Response(challenge, { status: 200 })
      }

      throw new Error("Forbidden")
    },
    {
      query: t.Object({
        "hub.mode": t.Optional(t.String()),
        "hub.verify_token": t.Optional(t.String()),
        "hub.challenge": t.Optional(t.String()),
      }),
    }
  )

  // GET /:id/events — list webhook events for a device (paginated)
  .get(
    "/:id/events",
    async ({ request, params, query, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      // Verify device exists and belongs to the org
      const device = await prisma.whatsappDevice.findUnique({
        where: { id: params.id },
        select: { organizationId: true },
      })

      if (!device) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Device not found." }
      }

      // Org-scoped filtering
      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        device.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      const page = Math.max(Number(query.page) || 1, 1)
      const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)

      const result = await listWebhookEvents({
        organizationId: device.organizationId,
        whatsappDeviceId: params.id,
        eventType: query.type,
        processingStatus: query.status,
        from: query.from,
        to: query.to,
        page,
        limit,
      })

      return {
        ok: true,
        data: result.data,
        meta: result.meta,
      }
    },
    {
      query: t.Object({
        type: t.Optional(t.String()),
        status: t.Optional(t.String()),
        from: t.Optional(t.String()),
        to: t.Optional(t.String()),
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )

  // POST /:id — Meta webhook incoming event
  // Inserts raw event BEFORE processing, then records outcome
  .post("/:id", async ({ params, body, set }: any) => {
    const deviceId = params.id

    // Look up device to get organizationId
    const device = await prisma.whatsappDevice.findUnique({
      where: { id: deviceId },
      select: { organizationId: true },
    })

    if (!device) {
      // Device not found — still return 200 to Meta
      return { status: "received" }
    }

    // Determine event type from payload structure
    const eventType = determineEventType(body)

    // 1. Insert raw webhook event BEFORE any processing
    const eventId = await createWebhookEvent(
      device.organizationId,
      deviceId,
      eventType,
      body as any
    )

    // 2. Process asynchronously
    ;(async () => {
      try {
        const result = await handleIncomingWebhook(
          body,
          deviceId,
          device.organizationId
        )
        await recordProcessingResult(
          eventId,
          result.success ? "SUCCESS" : "FAILED",
          result.success ? undefined : result.error
        )
      } catch (e) {
        console.error("Error processing whatsapp webhook:", e)
        await recordProcessingResult(eventId, "FAILED", String(e))
      }
    })().catch(console.error)

    set.status = 200
    return { status: "received" }
  })
