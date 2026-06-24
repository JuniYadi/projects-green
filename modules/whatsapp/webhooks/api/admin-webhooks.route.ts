/**
 * WhatsApp Webhooks — Admin API Routes
 *
 * Mounted at /api/admin/whatsapp/webhooks
 */

import { Elysia } from "elysia"
import { Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  requireSuperAdmin,
  type AdminActorContext,
  type AdminApiError,
} from "@/modules/admin/api/admin.guards"
import {
  webhookDispatcher,
  toDeliveryLogDTO,
  type WebhookDeliveryLogDTO,
} from "../webhook-dispatcher.service"

type RouteSet = { status?: number | string }
type AdminGuard = (set: RouteSet) => Promise<AdminActorContext | AdminApiError>

const isAdminError = (
  value: AdminActorContext | AdminApiError
): value is AdminApiError => "ok" in value && !value.ok

export const createAdminWebhooksRoutes = (
  deps: { requireSuperAdmin?: AdminGuard } = {}
) => {
  const guard: AdminGuard = deps.requireSuperAdmin ?? requireSuperAdmin

  return new Elysia({ prefix: "/admin/whatsapp/webhooks" })
    // GET / — list all webhooks (super admin, with org/device filter)
    .get("/", async ({ query, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const page = Math.max(Number(query.page) || 1, 1)
      const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
      const skip = (page - 1) * limit

      const where: Prisma.WhatsappWebhookWhereInput = {}
      if (query.organizationId) where.organizationId = query.organizationId
      if (query.deviceId) where.whatsappDeviceId = query.deviceId

      const [webhooks, total] = await Promise.all([
        prisma.whatsappWebhook.findMany({
          where,
          take: limit,
          skip,
          orderBy: { createdAt: "desc" },
          include: { whatsappDevice: { select: { phoneNumber: true } } },
        }),
        prisma.whatsappWebhook.count({ where }),
      ])

      return {
        ok: true,
        data: webhooks,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      }
    })

    // GET /:id — webhook detail
    .get("/:id", async ({ params: { id }, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const webhook = await prisma.whatsappWebhook.findUnique({
        where: { id },
        include: { whatsappDevice: { select: { phoneNumber: true } } },
      })

      if (!webhook) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      return { ok: true, data: webhook }
    })

    // POST / — create webhook
    .post("/", async ({ body, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const webhook = await prisma.whatsappWebhook.create({
        data: {
          whatsappDeviceId: body.whatsappDeviceId,
          organizationId: body.organizationId,
          webhookUrl: body.webhookUrl,
          verifyToken: body.verifyToken,
          authType: body.authType ?? "none",
          authValue: body.authValue ?? null,
          authHeaderName: body.authHeaderName ?? null,
          retryMaxAttempts: body.retryMaxAttempts ?? 3,
          retryIntervalMs: body.retryIntervalMs ?? 5000,
          active: body.active ?? true,
        },
      })

      return { ok: true, data: webhook }
    })

    // PATCH /:id — update webhook
    .patch("/:id", async ({ params: { id }, body, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const existing = await prisma.whatsappWebhook.findUnique({
        where: { id },
      })

      if (!existing) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      const updated = await prisma.whatsappWebhook.update({
        where: { id },
        data: body,
      })

      return { ok: true, data: updated }
    })

    // DELETE /:id — delete webhook
    .delete("/:id", async ({ params: { id }, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const existing = await prisma.whatsappWebhook.findUnique({
        where: { id },
      })

      if (!existing) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      await prisma.whatsappWebhook.delete({ where: { id } })
      return { ok: true }
    })

    // GET /:id/deliveries — paginated delivery logs for a webhook
    .get("/:id/deliveries", async ({ params: { id }, query, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const webhook = await prisma.whatsappWebhook.findUnique({
        where: { id },
        select: { id: true },
      })

      if (!webhook) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      const result = await webhookDispatcher.getDeliveryLogs(id, {
        eventType: query.eventType,
        status: query.status,
        from: query.from,
        to: query.to,
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
      })

      return { ok: true, data: result.data, meta: result.meta }
    })

    // POST /:id/deliveries/:deliveryId/resend — manual resend
    .post(
      "/:id/deliveries/:deliveryId/resend",
      async ({ params: { id, deliveryId }, set }: any) => {
        const actor = await guard(set)
        if (isAdminError(actor)) return actor

        const deliveryLog = await prisma.whatsappWebhookDeliveryLog.findUnique({
          where: { id: deliveryId },
          select: { webhookId: true },
        })

        if (!deliveryLog || deliveryLog.webhookId !== id) {
          set.status = 404
          return {
            ok: false,
            error: "NOT_FOUND",
            message: "Delivery log not found.",
          }
        }

        await webhookDispatcher.resendDelivery(deliveryId)

        return { ok: true, message: "Delivery re-enqueued for resend." }
      }
    )

    // POST /:id/test — send a test ping
    .post("/:id/test", async ({ params: { id }, set }: any) => {
      const actor = await guard(set)
      if (isAdminError(actor)) return actor

      const webhook = await prisma.whatsappWebhook.findUnique({
        where: { id },
      })

      if (!webhook) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      await webhookDispatcher.dispatch(
        id,
        "test",
        { test: true, timestamp: new Date().toISOString() }
      )

      return { ok: true, message: "Test webhook enqueued." }
    })
}
