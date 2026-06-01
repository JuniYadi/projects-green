import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { guardOrgRead, guardOrgWrite, guardOrgFull, type WhatsAppAuthContext } from "@/lib/whatsapp/auth"
import { enqueueWhatsAppBroadcast } from "@/lib/queue/whatsapp-broadcast"

const broadcastRecipientSchema = t.Object({
  phoneNumber: t.String(),
  name: t.Optional(t.String()),
  dynamicValues: t.Optional(t.Any()),
})

const broadcastCampaignBodySchema = t.Object({
  templateName: t.String(),
  templateLanguage: t.String(),
  templateParams: t.Optional(t.Any()),
  whatsappDeviceId: t.Optional(t.String()),
  whatsappContactGroupId: t.Optional(t.String()),
  throttleMaxMessages: t.Optional(t.Number()),
  throttlePerMinutes: t.Optional(t.Number()),
  recipients: t.Array(broadcastRecipientSchema),
})

const broadcastCampaignUpdateSchema = t.Partial(
  t.Omit(broadcastCampaignBodySchema, ["recipients"])
)

export const broadcastsRoutes = new Elysia({ prefix: "/broadcasts" })
  .get("/", guardOrgRead(async ({ whatsappAuth }: { whatsappAuth: WhatsAppAuthContext }) => {
    const campaigns = await prisma.whatsappBroadcastCampaign.findMany({
      where: whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin"
        ? { organizationId: whatsappAuth.organizationId! }
        : {},
      include: {
        _count: {
          select: { recipients: true }
        }
      },
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, campaigns }
  }))
  .get("/:id", guardOrgRead(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: WhatsAppAuthContext, set: any }) => {
    const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
      where: { id },
      include: {
        recipients: true,
      },
    })

    if (!campaign) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Broadcast campaign not found." }
    }

    if (whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" && campaign.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    return { ok: true, campaign }
  }))
  .post("/", guardOrgWrite(async ({ body, whatsappAuth, set }: { body: any, whatsappAuth: WhatsAppAuthContext, set: any }) => {
    if (whatsappAuth.type === "workos" && !whatsappAuth.organizationId) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Organization ID required." }
    }

    const { recipients, ...campaignData } = body
    const organizationId = whatsappAuth.type === "workos" ? whatsappAuth.organizationId! : (body as any).organizationId

    const campaign = await prisma.whatsappBroadcastCampaign.create({
      data: {
        ...campaignData,
        organizationId,
        total: recipients.length,
        queued: recipients.length,
        recipients: {
          create: recipients,
        },
      },
      include: {
        recipients: true,
      },
    })

    return { ok: true, campaign }
  }), {
    body: broadcastCampaignBodySchema
  })
  .patch("/:id", guardOrgWrite(async ({ params: { id }, body, whatsappAuth, set }: { params: { id: string }, body: any, whatsappAuth: WhatsAppAuthContext, set: any }) => {
    const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
      where: { id },
    })

    if (!campaign) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Broadcast campaign not found." }
    }

    if (whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" && campaign.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    const updated = await prisma.whatsappBroadcastCampaign.update({
      where: { id },
      data: body,
    })

    return { ok: true, campaign: updated }
  }), {
    body: broadcastCampaignUpdateSchema
  })
  .delete("/:id", guardOrgFull(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: WhatsAppAuthContext, set: any }) => {
    const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
      where: { id },
    })

    if (!campaign) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Broadcast campaign not found." }
    }

    if (whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" && campaign.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    await prisma.whatsappBroadcastCampaign.delete({
      where: { id },
    })

    return { ok: true, message: "Broadcast campaign deleted." }
  }))
  .post("/:id/send", guardOrgWrite(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: WhatsAppAuthContext, set: any }) => {
    const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
      where: { id },
      include: {
        recipients: {
          where: { status: "QUEUED" }
        }
      }
    })

    if (!campaign) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Broadcast campaign not found." }
    }

    if (whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" && campaign.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    if (campaign.status !== "QUEUED") {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Campaign is already processing or completed." }
    }

    // Update campaign status to processing
    await prisma.whatsappBroadcastCampaign.update({
      where: { id },
      data: {
        status: "PROCESSING",
        startedAt: new Date()
      }
    })

    // Enqueue each recipient for dispatch
    for (const recipient of campaign.recipients) {
      await enqueueWhatsAppBroadcast(campaign.id, recipient.id, "dispatch")
    }

    return { ok: true, message: `Dispatched ${campaign.recipients.length} recipients for broadcasting.` }
  }))
