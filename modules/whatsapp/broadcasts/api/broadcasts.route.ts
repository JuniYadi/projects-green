import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import {
  enqueueWhatsAppBroadcast,
  getWhatsAppBroadcastQueue,
  WHATSAPP_BROADCAST_JOB_NAME,
} from "@/lib/queue/whatsapp-broadcast"
import { toWhatsappBroadcastCampaignDTO } from "../broadcasts.dto"
import {
  getDeviceBroadcastCapacity,
  computeRecommendedSchedule,
  validateSchedule,
} from "../broadcast-schedule.service"
import {
  toDeviceBroadcastCapacityDTO,
  toBroadcastScheduleRecommendationDTO,
} from "../broadcast-schedule.dto"
import {
  formatBroadcastVariableValidationError,
  validateBroadcastRecipientVariables,
  validateBroadcastPreflight,
} from "../broadcast-preflight"
const E164_REGEX = /^[+]?[1-9]\d{6,14}$/
const broadcastRecipientSchema = t.Object({
  phoneNumber: t.String({
    pattern: "^[+]?[1-9]\\d{6,14}$",
    example: "+6281234567890",
    description: "Recipient phone number in E.164 format",
  }),
  name: t.Optional(
    t.String({ example: "Budi Santoso", description: "Recipient contact name" })
  ),
  dynamicValues: t.Optional(
    t.Any({
      example: { "1": "Budi Santoso", "2": "#ORD-9981" },
      description: "Positional template variable key-values",
    })
  ),
})

const broadcastCampaignBodySchema = t.Object({
  templateId: t.String({
    example: "tpl_clt9876543210",
    description: "Approved Meta WhatsApp template ID",
  }),
  templateName: t.String({
    example: "order_status_notification",
    description: "Template slug name",
  }),
  templateLanguage: t.String({
    example: "id",
    description: "Language locale code (e.g. 'id', 'en_US')",
  }),
  templateParams: t.Optional(t.Any()),
  whatsappDeviceId: t.String({
    example: "dev_clt1234567890",
    description: "Connected WhatsApp device ID",
  }),
  whatsappContactGroupId: t.Optional(
    t.String({
      example: "grp_clt1234567890",
      description: "Optional saved contact group ID",
    })
  ),
  throttleMaxMessages: t.Optional(
    t.Number({
      example: 20,
      description: "Maximum messages per throttle window",
    })
  ),
  throttlePerMinutes: t.Optional(
    t.Number({
      example: 1,
      description: "Throttle interval in minutes",
    })
  ),
  acknowledgeMultiDay: t.Optional(
    t.Boolean({
      example: false,
      description: "Acknowledge if broadcast duration exceeds 24 hours",
    })
  ),
  recipients: t.Array(broadcastRecipientSchema, {
    description: "List of recipients with phone numbers and variable values",
  }),
})

const broadcastCampaignUpdateSchema = t.Partial(
  t.Omit(broadcastCampaignBodySchema, ["recipients"])
)

const broadcastPreviewBodySchema = t.Object({
  whatsappDeviceId: t.String({
    example: "dev_clt1234567890",
    description: "Active WhatsApp device ID",
  }),
  recipients: t.Array(broadcastRecipientSchema),
})
const broadcastPreflightBodySchema = t.Object({
  templateId: t.String({
    example: "tpl_clt9876543210",
    description: "Meta template ID",
  }),
  templateLanguage: t.String({
    example: "id",
    description: "Template language code",
  }),
  whatsappDeviceId: t.String({
    example: "dev_clt1234567890",
    description: "Sender WhatsApp device ID",
  }),
  throttleMaxMessages: t.Optional(t.Number({ example: 20 })),
  throttlePerMinutes: t.Optional(t.Number({ example: 1 })),
  acknowledgeMultiDay: t.Optional(t.Boolean({ example: false })),
  recipients: t.Array(broadcastRecipientSchema),
})

const broadcastCampaignDTOSchema = t.Object({
  id: t.String({ example: "bc_clt1234567890" }),
  organizationId: t.String({ example: "org_2tQ1y09..." }),
  templateId: t.String({ example: "tpl_clt9876543210" }),
  templateName: t.String({ example: "order_status_notification" }),
  templateLanguage: t.String({ example: "id" }),
  whatsappDeviceId: t.String({ example: "dev_clt1234567890" }),
  status: t.String({ example: "QUEUED" }),
  totalRecipients: t.Number({ example: 500 }),
  sentCount: t.Number({ example: 0 }),
  failedCount: t.Number({ example: 0 }),
  createdAt: t.Optional(t.Any()),
  updatedAt: t.Optional(t.Any()),
})
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

type BroadcastPreflightRecipient = {
  dynamicValues?: unknown
}

type BroadcastPreflightPayload = {
  templateId: string
  templateLanguage: string
  whatsappDeviceId: string
  throttleMaxMessages?: number
  throttlePerMinutes?: number
  acknowledgeMultiDay?: boolean
  recipients: BroadcastPreflightRecipient[]
}

type ValidatedBroadcastSelection = {
  deviceId: string
  templateId: string
  templateName: string
  templateLanguage: string
  templateBody: string | null
}

async function resolveBroadcastSelection({
  organizationId,
  templateId,
  templateLanguage,
  deviceId,
}: {
  organizationId: string
  templateId: string
  templateLanguage: string
  deviceId: string
}): Promise<ValidatedBroadcastSelection | null> {
  const [device, template] = await Promise.all([
    prisma.whatsappDevice.findFirst({
      where: { id: deviceId, organizationId, status: "ACTIVE" },
      select: { id: true },
    }),
    prisma.whatsappTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
        whatsappDeviceId: deviceId,
        syncStatus: "SYNCED",
        metaStatus: "APPROVED",
        languages: {
          some: {
            lang: templateLanguage,
            OR: [{ isApproved: true }, { metaStatus: "APPROVED" }],
          },
        },
      },
      select: {
        id: true,
        name: true,
        languages: {
          where: {
            lang: templateLanguage,
            OR: [{ isApproved: true }, { metaStatus: "APPROVED" }],
          },
          select: { body: true },
          take: 1,
        },
      },
    }),
  ])

  const language = template?.languages[0]
  if (!device || !template || !language) {
    return null
  }

  return {
    deviceId: device.id,
    templateId: template.id,
    templateName: template.name,
    templateLanguage,
    templateBody: language.body,
  }
}

async function validateBroadcastPreflight({
  organizationId,
  payload,
  enforceSchedule = true,
}: {
  organizationId: string
  payload: BroadcastPreflightPayload
  enforceSchedule?: boolean
}): Promise<
  | {
      ok: true
      selection: ValidatedBroadcastSelection
      capacity: Awaited<ReturnType<typeof getDeviceBroadcastCapacity>>
      recommendation: Awaited<ReturnType<typeof computeRecommendedSchedule>>
    }
  | { ok: false; message: string }
> {
  if (payload.recipients.length === 0) {
    return {
      ok: false,
      message: "Add at least one valid recipient before continuing.",
    }
  }

  const selection = await resolveBroadcastSelection({
    organizationId,
    templateId: payload.templateId,
    templateLanguage: payload.templateLanguage,
    deviceId: payload.whatsappDeviceId,
  })
  if (!selection) {
    return {
      ok: false,
      message:
        "Select an active device, approved template, and valid language.",
    }
  }

  const variables = validateBroadcastRecipientVariables({
    templateBody: selection.templateBody,
    recipients: payload.recipients,
  })
  if (!variables.isValid) {
    return {
      ok: false,
      message: formatBroadcastVariableValidationError(variables),
    }
  }

  const hasThrottleMax = payload.throttleMaxMessages !== undefined
  const hasThrottlePeriod = payload.throttlePerMinutes !== undefined
  if (hasThrottleMax !== hasThrottlePeriod) {
    return {
      ok: false,
      message:
        "Provide both throttle values, or leave both empty to use device limits.",
    }
  }

  try {
    const capacity = await getDeviceBroadcastCapacity(
      organizationId,
      payload.whatsappDeviceId
    )
    const recommendation = await computeRecommendedSchedule({
      totalRecipients: payload.recipients.length,
      organizationId,
      deviceId: payload.whatsappDeviceId,
    })

    if (enforceSchedule && hasThrottleMax && hasThrottlePeriod) {
      await validateSchedule({
        throttleMaxMessages: payload.throttleMaxMessages!,
        throttlePerMinutes: payload.throttlePerMinutes!,
        totalRecipients: payload.recipients.length,
        organizationId,
        deviceId: payload.whatsappDeviceId,
        acknowledgeMultiDay: payload.acknowledgeMultiDay,
      })
    }

    return { ok: true, selection, capacity, recommendation }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Broadcast preflight failed.",
    }
  }
}

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )
  return { page, limit, skip: (page - 1) * limit }
}

export const broadcastsRoutes = new Elysia({
  prefix: "/broadcasts",
  detail: {
    tags: ["WhatsApp Broadcasts"],
  },
})
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
    },
    {
      detail: {
        summary: "List Broadcast Campaigns",
        description:
          "Retrieves a paginated list of broadcast campaigns for the active organization.",
        tags: ["WhatsApp Broadcasts"],
      },
    }
  )
  .get(
    "/summary",
    async ({
      request,
      query,
      set,
    }: {
      request: Request
      query: { organizationId?: string }
      set: { status?: number | string }
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      const isSuperAdmin =
        whatsappAuth.type === "workos" &&
        whatsappAuth.platformRole === "super_admin"
      if (
        whatsappAuth.type === "workos" &&
        !whatsappAuth.organizationId &&
        !isSuperAdmin
      ) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Organization ID required.",
        }
      }

      const organizationId = isSuperAdmin
        ? query.organizationId
        : whatsappAuth.organizationId
      const where = organizationId ? { organizationId } : {}
      const [total, active, sent, failed] = await Promise.all([
        prisma.whatsappBroadcastCampaign.count({ where }),
        prisma.whatsappBroadcastCampaign.count({
          where: {
            ...where,
            status: { in: ["QUEUED", "PROCESSING"] },
          },
        }),
        prisma.whatsappBroadcastCampaign.aggregate({
          where,
          _sum: { sent: true },
        }),
        prisma.whatsappBroadcastCampaign.aggregate({
          where,
          _sum: { failed: true },
        }),
      ])

      return {
        ok: true,
        total,
        active,
        sent: sent._sum.sent ?? 0,
        failed: failed._sum.failed ?? 0,
      }
    },
    {
      detail: {
        summary: "Get Broadcast Analytics Summary",
        description:
          "Returns aggregated statistics on total campaigns, queued recipients, and delivery success counts.",
        tags: ["WhatsApp Broadcasts"],
      },
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
    },
    {
      params: t.Object({
        id: t.String({
          example: "bc_clt1234567890",
          description: "Broadcast campaign ID",
        }),
      }),
      detail: {
        summary: "Get Broadcast Campaign Details",
        description:
          "Fetches full campaign parameters, throttling configs, and status.",
        tags: ["WhatsApp Broadcasts"],
      },
    }
  )
  .post(
    "/preflight",
    async ({
      request,
      body,
      set,
    }: {
      request: Request
      body: BroadcastPreflightPayload
      set: { status?: number | string }
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (whatsappAuth.type !== "workos" || !whatsappAuth.organizationId) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Organization ID required.",
        }
      }

      if (!body.recipients || body.recipients.length === 0) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Add at least one valid recipient before continuing.",
        }
      }

      const preflight = await validateBroadcastPreflight({
        organizationId: whatsappAuth.organizationId,
        payload: body,
        enforceSchedule: false,
      })
      if (!preflight.ok) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: preflight.message,
        }
      }

      return {
        ok: true,
        selection: preflight.selection,
        recipientCount: body.recipients.length,
        dispatchMode: "MANUAL_DISPATCH" as const,
        capacity: toDeviceBroadcastCapacityDTO(preflight.capacity),
        recommendation: toBroadcastScheduleRecommendationDTO(
          preflight.recommendation
        ),
      }
    },
    {
      body: broadcastPreflightBodySchema,
      detail: {
        summary: "Preflight Validate Broadcast Recipients",
        description:
          "Validates recipient dynamic variable placeholders against template parameters before initiating dispatch.",
        tags: ["WhatsApp Broadcasts"],
      },
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

      const {
        recipients,
        templateId,
        templateName: _templateName,
        ...campaignData
      } = body
      const organizationId =
        whatsappAuth.organizationId ?? (body as any).organizationId ?? ""

      const preflight = await validateBroadcastPreflight({
        organizationId,
        payload: {
          templateId,
          templateLanguage: campaignData.templateLanguage,
          whatsappDeviceId: campaignData.whatsappDeviceId,
          throttleMaxMessages: campaignData.throttleMaxMessages,
          throttlePerMinutes: campaignData.throttlePerMinutes,
          acknowledgeMultiDay: campaignData.acknowledgeMultiDay,
          recipients,
        },
      })
      if (!preflight.ok) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: preflight.message,
        }
      }

      const campaign = await prisma.whatsappBroadcastCampaign.create({
        data: {
          ...campaignData,
          templateId: preflight.selection.templateId,
          templateName: preflight.selection.templateName,
          acknowledgeMultiDay: campaignData.acknowledgeMultiDay ?? false,
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
      detail: {
        summary: "Create Broadcast Campaign",
        description:
          "Creates a new bulk message broadcast campaign with recipient list, throttling settings, and template parameters.",
        tags: ["WhatsApp Broadcasts"],
      },
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
      params: t.Object({
        id: t.String({
          example: "bc_clt1234567890",
          description: "Broadcast campaign ID",
        }),
      }),
      body: broadcastCampaignUpdateSchema,
      detail: {
        summary: "Update Draft Broadcast Campaign",
        description:
          "Updates campaign metadata and throttling parameters before launch.",
        tags: ["WhatsApp Broadcasts"],
      },
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
      return { ok: true, message: "Campaign deleted." }
    },
    {
      params: t.Object({
        id: t.String({
          example: "bc_clt1234567890",
          description: "Broadcast campaign ID",
        }),
      }),
      detail: {
        summary: "Delete Broadcast Campaign",
        description:
          "Deletes a draft or completed broadcast campaign and its associated recipient log entries.",
        tags: ["WhatsApp Broadcasts"],
      },
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

      if (!campaign.templateId || !campaign.whatsappDeviceId) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message:
            "This broadcast is missing its selected template or device. Recreate it before sending.",
        }
      }

      const preflight = await validateBroadcastPreflight({
        organizationId: campaign.organizationId,
        payload: {
          templateId: campaign.templateId,
          templateLanguage: campaign.templateLanguage,
          whatsappDeviceId: campaign.whatsappDeviceId,
          throttleMaxMessages: campaign.throttleMaxMessages ?? undefined,
          throttlePerMinutes: campaign.throttlePerMinutes ?? undefined,
          acknowledgeMultiDay: campaign.acknowledgeMultiDay,
          recipients: campaign.recipients,
        },
      })
      if (!preflight.ok) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: preflight.message,
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
            jobId: `wa-broadcast_dispatch_${campaign.id}_${r.id}_${Bun.randomUUIDv7()}`,
          },
        }))
      )

      return {
        ok: true,
        message: `Dispatched ${campaign.recipients.length} recipients for broadcasting.`,
      }
    },
    {
      params: t.Object({
        id: t.String({
          example: "bc_clt1234567890",
          description: "Broadcast campaign ID",
        }),
      }),
      detail: {
        summary: "Launch Broadcast Campaign",
        description:
          "Enqueues background worker job to start sending bulk messages according to configured throttle rules.",
        tags: ["WhatsApp Broadcasts"],
      },
    }
  )
  .post(
    "/preview",
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

      const organizationId =
        whatsappAuth.organizationId ?? body.organizationId ?? ""

      try {
        const [capacity, recommendation] = await Promise.all([
          getDeviceBroadcastCapacity(organizationId, body.whatsappDeviceId),
          computeRecommendedSchedule({
            totalRecipients: body.recipients.length,
            organizationId,
            deviceId: body.whatsappDeviceId,
          }),
        ])

        return {
          ok: true,
          capacity: toDeviceBroadcastCapacityDTO(capacity),
          recommendation: toBroadcastScheduleRecommendationDTO(recommendation),
        }
      } catch (error) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Preview failed",
        }
      }
    },
    {
      body: broadcastPreviewBodySchema,
      detail: {
        summary: "Preview Broadcast Schedule & Capacity",
        description:
          "Calculates estimated dispatch duration and recommended throttle pacing based on sender device quota tier.",
        tags: ["WhatsApp Broadcasts"],
      },
    }
  )
