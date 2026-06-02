import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

export const webhooksRoutes = new Elysia({ prefix: "/webhooks" })

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
        prisma.whatsappWebhook.findMany({ where, take: limit, skip, orderBy: { createdAt: "desc" } }),
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
  .get(
    "/:id",
    async ({ request, params, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const webhook = await prisma.whatsappWebhook.findUnique({ where: { id: params.id } })
      if (!webhook) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      if ((whatsappAuth as any).platformRole !== "super_admin" && webhook.organizationId !== whatsappAuth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      return webhook
    }
  )

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
        return { ok: false, error: "BAD_REQUEST", message: "Organization ID required." }
      }
      const webhook = await prisma.whatsappWebhook.create({
        data: {
          whatsappDeviceId: body.deviceId,
          organizationId: whatsappAuth.organizationId,
          webhookUrl: body.webhookUrl,
          verifyToken: body.verifyToken,
          active: true,
        },
      })
      return { ok: true, data: webhook }
    },
    {
      body: t.Object({
        deviceId: t.String(),
        webhookUrl: t.String(),
        verifyToken: t.String(),
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
      const webhook = await prisma.whatsappWebhook.findUnique({ where: { id: params.id } })
      if (!webhook) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      if ((whatsappAuth as any).platformRole !== "super_admin" && webhook.organizationId !== whatsappAuth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      const updated = await prisma.whatsappWebhook.update({ where: { id: params.id }, data: body })
      return { ok: true, data: updated }
    },
    {
      body: t.Partial(
        t.Object({
          webhookUrl: t.String(),
          verifyToken: t.String(),
          active: t.Boolean(),
        })
      ),
    }
  )

  // DELETE /:id — delete webhook config
  .delete(
    "/:id",
    async ({ request, params, set }: any) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const webhook = await prisma.whatsappWebhook.findUnique({ where: { id: params.id } })
      if (!webhook) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Webhook not found." }
      }

      if ((whatsappAuth as any).platformRole !== "super_admin" && webhook.organizationId !== whatsappAuth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      await prisma.whatsappWebhook.delete({ where: { id: params.id } })
      return { ok: true }
    }
  )

  // GET /:id/verify — Meta webhook verification endpoint
  .get(
    "/:id/verify",
    async ({
      params,
      query,
    }: any) => {
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

  // POST /:id — Meta webhook incoming event (immediate 200, background processing)
  .post("/:id", async ({ params, body }: any) => {
    // Respond immediately to Meta's webhook
    const { id } = params
    ;(async () => {
      try {
        await prisma.whatsappLog.create({
          data: {
            organizationId: "system",
            whatsappDeviceId: id,
            type: "INBOX",
            message: "Incoming Webhook Event",
            metadata: body as any,
          },
        })
      } catch (e) {
        console.error("Error processing whatsapp webhook:", e)
      }
    })().catch(console.error)

    return { status: "received" }
  })
