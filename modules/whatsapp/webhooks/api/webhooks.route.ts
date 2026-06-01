import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { guardOrgRead, guardOrgWrite, guardOrgFull } from "@/lib/whatsapp/auth"

export const webhooksRoutes = new Elysia({ prefix: "/webhooks" })

  // GET / — list webhook configs (paginated)
  .get(
    "/",
    guardOrgRead(async ({ query, whatsappAuth, set }: any) => {
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
    }),
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
    guardOrgRead(async ({ params, whatsappAuth, set }: any) => {
      const webhook = await prisma.whatsappWebhook.findUnique({ where: { id: params.id } })
      if (!webhook) throw new Error("Webhook not found")
      return webhook
    })
  )

  // POST / — create webhook config
  .post(
    "/",
    guardOrgWrite(async ({ body, whatsappAuth, set }: any) => {
      const webhook = await prisma.whatsappWebhook.create({
        data: {
          whatsappDeviceId: body.deviceId,
          organizationId: body.organizationId,
          webhookUrl: body.webhookUrl,
          verifyToken: body.verifyToken,
          active: true,
        },
      })
      return { ok: true, data: webhook }
    }),
    {
      body: t.Object({
        organizationId: t.String(),
        deviceId: t.String(),
        webhookUrl: t.String(),
        verifyToken: t.String(),
      }),
    }
  )

  // PATCH /:id — update webhook config
  .patch(
    "/:id",
    guardOrgWrite(async ({ params, body, whatsappAuth, set }: any) => {
      const updated = await prisma.whatsappWebhook.update({ where: { id: params.id }, data: body })
      return { ok: true, data: updated }
    }),
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
    guardOrgFull(async ({ params, whatsappAuth, set }: any) => {
      await prisma.whatsappWebhook.delete({ where: { id: params.id } })
      return { ok: true }
    })
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
