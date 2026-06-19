import { Elysia, t } from "elysia"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import {
  enqueueWhatsAppBroadcast,
  getWhatsAppBroadcastQueue,
  WHATSAPP_BROADCAST_JOB_NAME,
} from "@/lib/queue/whatsapp-broadcast"
import { toWhatsappBroadcastCampaignDTO } from "../broadcasts.dto"

const E164_REGEX = /^[+]?[1-9]\d{6,14}$/
const broadcastRecipientSchema = t.Object({
  phoneNumber: t.String({ pattern: "^[+]?[1-9]\\d{6,14}$" }),
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
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )
  return { page, limit, skip: (page - 1) * limit }
}

export const broadcastsRoutes = new Elysia({ prefix: "/broadcasts" })
  .get(
    "/",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const { page, limit, skip } = getPagination(query)
      const where =
        whatsappAuth.type === "workos" &&
        whatsappAuth.platformRole !== "super_admin"
          ? { organizationId: whatsappAuth.organizationId! }
          : {}
      const [total, campaigns] = await Promise.all([
        prisma.whatsappBroadcastCampaign.count({ where }),
        prisma.whatsappBroadcastCampaign.findMany({
          where,
          include: {
            _count: {
              select: { recipients: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ])
      const data = campaigns.map(toWhatsappBroadcastCampaignDTO)
      return {
        ok: true,
        campaigns: data,
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      }
    }
  )
  .get(
    "/:id",
    async ({
      request,
      params: { id },
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
        where: { id },
        include: {
          recipients: true,
        },
      })

      if (!campaign) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Broadcast campaign not found.",
        }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        campaign.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      return { ok: true, campaign: toWhatsappBroadcastCampaignDTO(campaign) }
    }
  )
  .post(
    "/",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (whatsappAuth.type === "workos" && !whatsappAuth.organizationId) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Organization ID required.",
        }
      }

      const { recipients, ...campaignData } = body
      const organizationId =
        whatsappAuth.type === "workos"
          ? whatsappAuth.organizationId!
          : (body as any).organizationId

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

      return { ok: true, campaign: toWhatsappBroadcastCampaignDTO(campaign) }
    },
    {
      body: broadcastCampaignBodySchema,
    }
  )
  .patch(
    "/:id",
    async ({
      request,
      params: { id },
      body,
      set,
    }: {
      request: any
      params: { id: string }
      body: any
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
        where: { id },
      })

      if (!campaign) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Broadcast campaign not found.",
        }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        campaign.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      // Validate state transitions
      const VALID_TRANSITIONS: Record<string, string[]> = {
        QUEUED: ["PROCESSING", "CANCELLED"],
        PROCESSING: [
          "PAUSED",
          "COMPLETED",
          "COMPLETED_WITH_ERRORS",
          "CANCELLED",
        ],
        PAUSED: ["PROCESSING", "CANCELLED"],
        COMPLETED: [],
        COMPLETED_WITH_ERRORS: [],
        CANCELLED: [],
      }
      if (
        body.status &&
        !VALID_TRANSITIONS[campaign.status]?.includes(body.status)
      ) {
        set.status = 400
        return {
          ok: false,
          error: "INVALID_TRANSITION",
          message: `Cannot transition from ${campaign.status} to ${body.status}`,
        }
      }

      const updated = await prisma.whatsappBroadcastCampaign.update({
        where: { id },
        data: body,
      })

      return { ok: true, campaign: toWhatsappBroadcastCampaignDTO(updated) }
    },
    {
      body: broadcastCampaignUpdateSchema,
    }
  )
  .delete(
    "/:id",
    async ({
      request,
      params: { id },
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
        where: { id },
      })

      if (!campaign) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Broadcast campaign not found.",
        }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        campaign.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      await prisma.whatsappBroadcastCampaign.delete({
        where: { id },
      })

      return { ok: true, message: "Broadcast campaign deleted." }
    }
  )
  .post(
    "/:id/send",
    async ({
      request,
      params: { id },
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const campaign = await prisma.whatsappBroadcastCampaign.findUnique({
        where: { id },
        include: {
          recipients: {
            where: { status: "QUEUED" },
          },
        },
      })

      if (!campaign) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Broadcast campaign not found.",
        }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        campaign.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      if (campaign.status !== "QUEUED") {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Campaign is already processing or completed.",
        }
      }

      // Update campaign status to processing
      await prisma.whatsappBroadcastCampaign.update({
        where: { id },
        data: {
          status: "PROCESSING",
          startedAt: new Date(),
        },
      })

      // Enqueue all recipients in bulk
      const queue = getWhatsAppBroadcastQueue()
      await queue.addBulk(
        campaign.recipients.map((r) => ({
          name: WHATSAPP_BROADCAST_JOB_NAME,
          data: {
            campaignId: campaign.id,
            recipientId: r.id,
            method: "dispatch" as const,
          },
          opts: {
            jobId: `wa-broadcast:dispatch:${campaign.id}:${r.id}:${randomUUID()}`,
          },
        }))
      )

      return {
        ok: true,
        message: `Dispatched ${campaign.recipients.length} recipients for broadcasting.`,
      }
    }
  )
