import { Elysia, t } from "elysia"
import type { Prisma, WhatsappActivityType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { normalizeIndonesianPhoneNumber } from "@/modules/whatsapp/messages/phone-number"
const DEFAULT_CONVERSATION_LIMIT = 50
const MAX_CONVERSATION_LIMIT = 100

const parseConversationLimit = (value: unknown): number => {
  const num = Number(value)
  if (!Number.isFinite(num)) return DEFAULT_CONVERSATION_LIMIT
  return Math.min(Math.max(Math.trunc(num), 1), MAX_CONVERSATION_LIMIT)
}
const isSuperAdmin = (auth: any) =>
  auth?.type === "workos" && auth?.platformRole === "super_admin"

const toNoOrganization = (set: any) => {
  set.status = 403
  return {
    ok: false,
    error: "FORBIDDEN",
    message: "No active organization found.",
  }
}
const conversationBodySchema = t.Object({
  contactPhone: t.String({
    minLength: 10,
    maxLength: 20,
    example: "+6281234567890",
    description: "Contact WhatsApp phone number in E.164 format",
  } as any),
  whatsappDeviceId: t.Optional(
    t.Nullable(
      t.String({
        example: "dev_clt1234567890",
        description: "Assigned WhatsApp device ID for this thread",
      })
    )
  ),
})

const conversationUpdateSchema = t.Partial(
  t.Object({
    whatsappDeviceId: t.Nullable(t.String()),
    internalNotes: t.Nullable(t.String()),
    labelIds: t.Nullable(t.Array(t.String())),
    status: t.Optional(
      t.Union([t.Literal("OPEN"), t.Literal("PENDING"), t.Literal("RESOLVED")])
    ),
    stage: t.Optional(
      t.Nullable(
        t.Union([
          t.Literal("NEW"),
          t.Literal("CONTACTED"),
          t.Literal("QUALIFIED"),
          t.Literal("PROPOSAL"),
          t.Literal("NEGOTIATION"),
          t.Literal("WON"),
          t.Literal("LOST"),
        ])
      )
    ),
    assigneeId: t.Optional(t.Nullable(t.String())),
    lastReadAt: t.Optional(t.Nullable(t.String())),
    csatScore: t.Optional(t.Nullable(t.Number({ minimum: 1, maximum: 5 }))),
  })
)

const noteBodySchema = t.Object({
  body: t.String({
    minLength: 1,
    example: "Customer requested pricing follow-up on @sales_agent",
    description: "Internal team note with optional @mentions",
  }),
  authorName: t.Optional(
    t.Nullable(
      t.String({
        example: "Budi Santoso",
        description: "Author display name",
      })
    )
  ),
})

function extractMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9._-]+)/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(1)))]
}

const labelBodySchema = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 50,
    example: "VIP Customer",
    description: "Unique label name",
  }),
  color: t.Optional(
    t.Nullable(
      t.String({
        maxLength: 7,
        example: "#22c55e",
        description: "Hex color code for the label badge",
      })
    )
  ),
})

export const conversationsRoutes = new Elysia({
  prefix: "/conversations",
  detail: {
    tags: ["WhatsApp Conversations"],
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
      const isSuper = isSuperAdmin(whatsappAuth)
      if (!isSuper && !whatsappAuth.organizationId) return toNoOrganization(set)

      const {
        contactPhone,
        status,
        lifecycleStatus,
        stage,
        assigneeId,
        unreadOnly,
        limit,
        organizationId: queryOrgId,
        whatsappDeviceId,
      } = query as any

      const where: any = {}
      if (!isSuper) {
        where.organizationId = whatsappAuth.organizationId
      } else if (queryOrgId) {
        where.organizationId = String(queryOrgId)
      }
      if (whatsappDeviceId) {
        where.whatsappDeviceId = String(whatsappDeviceId)
      }
      if (contactPhone) {
        const normalized = normalizeIndonesianPhoneNumber(contactPhone)
        if (normalized) {
          where.OR = [
            { contactPhone: { contains: contactPhone } },
            { contactPhone: { contains: normalized } },
            { contactPhone: { contains: normalized.replace("+", "") } },
          ]
        } else {
          where.contactPhone = { contains: contactPhone }
        }
      }

      if (
        lifecycleStatus &&
        ["OPEN", "PENDING", "RESOLVED"].includes(lifecycleStatus.toUpperCase())
      ) {
        where.status = lifecycleStatus.toUpperCase()
      }

      const VALID_STAGES = [
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "PROPOSAL",
        "NEGOTIATION",
        "WON",
        "LOST",
      ]
      if (stage && VALID_STAGES.includes(stage.toUpperCase())) {
        where.stage = stage.toUpperCase()
      }

      if (assigneeId !== undefined) {
        where.assigneeId = assigneeId === "unassigned" ? null : assigneeId
      }

      if (unreadOnly === "true" || unreadOnly === true) {
        where.lastDirection = "INBOX"
      }

      // Filter conversations that have messages with the given message delivery status
      if (status && status !== "all") {
        where.whatsappMessages = {
          some: {
            statusHistory: {
              some: { status },
            },
          },
        }
      }
      const take = parseConversationLimit(limit)

      const conversations = await prisma.whatsappConversation.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        take,
        include: {
          _count: {
            select: { whatsappMessages: true },
          },
          whatsappDevice: {
            select: {
              id: true,
              phoneNumber: true,
              whatsappProfile: true,
            },
          },
          conversationLabels: {
            include: { label: true },
          },
          whatsappMessages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      })

      return { ok: true, conversations }
    },
    {
      query: t.Optional(
        t.Object({
          contactPhone: t.Optional(t.String()),
          status: t.Optional(t.String()),
          lifecycleStatus: t.Optional(t.String()),
          stage: t.Optional(t.String()),
          assigneeId: t.Optional(t.String()),
          unreadOnly: t.Optional(t.Union([t.String(), t.Boolean()])),
          limit: t.Optional(t.Union([t.String(), t.Number()])),
          organizationId: t.Optional(t.String()),
          whatsappDeviceId: t.Optional(t.String()),
        })
      ),
      detail: {
        summary: "List WhatsApp Conversation Threads",
        description:
          "Retrieves inbox and outbox conversation threads with latest messages, labels, stages, and assignee info.",
        tags: ["WhatsApp Conversations"],
      },
    }
  )
  // ── Conversation Labels ───────────────────────────────────────────────
  .get(
    "/labels",
    async ({ request, set }: { request: any; set: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!whatsappAuth.organizationId) return toNoOrganization(set)
      const labels = await prisma.whatsappConversationLabel.findMany({
        where: { organizationId: whatsappAuth.organizationId },
        orderBy: { name: "asc" },
      })
      return { ok: true, labels }
    },
    {
      detail: {
        summary: "List Conversation Labels",
        description:
          "Retrieves all conversation badges/labels configured for the organization.",
        tags: ["WhatsApp Conversations"],
      },
    }
  )
  .post(
    "/labels",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!whatsappAuth.organizationId) return toNoOrganization(set)
      const organizationId = whatsappAuth.organizationId
      try {
        const label = await prisma.whatsappConversationLabel.create({
          data: {
            organizationId,
            name: body.name,
            color: body.color ?? null,
          },
        })
        return { ok: true, label }
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "P2002"
        ) {
          set.status = 400
          return {
            ok: false,
            error: "ALREADY_EXISTS",
            message: "A label with this name already exists.",
          }
        }
        throw error
      }
    },
    {
      body: labelBodySchema,
      detail: {
        summary: "Create Conversation Label",
        description: "Creates a new color-coded conversation badge/label.",
        tags: ["WhatsApp Conversations"],
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
      const isSuper = isSuperAdmin(whatsappAuth)
      if (!isSuper && !whatsappAuth.organizationId) return toNoOrganization(set)
      const conversation = await prisma.whatsappConversation.findFirst({
        where: {
          id,
          ...(!isSuper && whatsappAuth.organizationId
            ? { organizationId: whatsappAuth.organizationId }
            : {}),
        },
        include: {
          _count: {
            select: { whatsappMessages: true },
          },
          whatsappMessages: {
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
              statusHistory: {
                orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
              },
            },
          },
          whatsappDevice: {
            select: {
              id: true,
              phoneNumber: true,
              whatsappProfile: true,
            },
          },
          conversationLabels: {
            include: { label: true },
          },
          notes: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      })

      if (!conversation) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Conversation not found.",
        }
      }
      return { ok: true, conversation }
    },
    {
      params: t.Object({
        id: t.String({
          example: "conv_clt1234567890",
          description: "Conversation thread ID",
        }),
      }),
      detail: {
        summary: "Get Conversation Thread Details",
        description:
          "Fetches full message history, internal notes, activity timeline, and labels for a conversation.",
        tags: ["WhatsApp Conversations"],
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
      if (!whatsappAuth.organizationId) return toNoOrganization(set)
      const organizationId = whatsappAuth.organizationId
      try {
        const normalizedPhone =
          normalizeIndonesianPhoneNumber(body.contactPhone) ?? body.contactPhone
        const conversation = await prisma.whatsappConversation.create({
          data: {
            ...body,
            contactPhone: normalizedPhone,
            organizationId,
          },
        })
        return { ok: true, conversation }
      } catch (error: any) {
        if (error.code === "P2002") {
          set.status = 400
          return {
            ok: false,
            error: "ALREADY_EXISTS",
            message: "Conversation with this phone already exists.",
          }
        }
        throw error
      }
    },
    {
      body: conversationBodySchema,
      detail: {
        summary: "Create Conversation Thread",
        description:
          "Initializes a conversation thread for a contact phone number.",
        tags: ["WhatsApp Conversations"],
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
      const isSuper = isSuperAdmin(whatsappAuth)
      if (!isSuper && !whatsappAuth.organizationId) return toNoOrganization(set)
      const conversation = await prisma.whatsappConversation.findFirst({
        where: {
          id,
          ...(!isSuper && whatsappAuth.organizationId
            ? { organizationId: whatsappAuth.organizationId }
            : {}),
        },
      })

      if (!conversation) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Conversation not found.",
        }
      }

      const data: Prisma.WhatsappConversationUncheckedUpdateInput = {}
      const activitiesToCreate: Array<{
        actorId: string
        actorName?: string
        type: WhatsappActivityType
        fromValue?: string
        toValue?: string
      }> = []

      const actorId =
        whatsappAuth.type === "workos"
          ? whatsappAuth.userId
          : whatsappAuth.organizationId
      const actorName =
        whatsappAuth.type === "workos"
          ? (whatsappAuth as any).userName || undefined
          : undefined
      if (body.whatsappDeviceId !== undefined) {
        data.whatsappDeviceId = body.whatsappDeviceId
      }
      if (body.internalNotes !== undefined) {
        data.internalNotes = body.internalNotes
      }
      if (body.status !== undefined && body.status !== conversation.status) {
        data.status = body.status
        activitiesToCreate.push({
          actorId,
          actorName,
          type: "STATUS_CHANGE",
          fromValue: conversation.status,
          toValue: body.status,
        })
      }
      if (body.stage !== undefined && body.stage !== conversation.stage) {
        data.stage = body.stage
        activitiesToCreate.push({
          actorId,
          actorName,
          type: "STAGE_CHANGE",
          fromValue: conversation.stage ?? undefined,
          toValue: body.stage ?? undefined,
        })
      }
      if (
        body.assigneeId !== undefined &&
        body.assigneeId !== conversation.assigneeId
      ) {
        data.assigneeId = body.assigneeId
        activitiesToCreate.push({
          actorId,
          actorName,
          type: "ASSIGNMENT_CHANGE",
          fromValue: conversation.assigneeId ?? undefined,
          toValue: body.assigneeId ?? undefined,
        })
      }
      if (body.lastReadAt !== undefined) {
        data.lastReadAt = body.lastReadAt ? new Date(body.lastReadAt) : null
      }
      if (body.csatScore !== undefined) {
        data.csatScore = body.csatScore
        activitiesToCreate.push({
          actorId,
          actorName,
          type: "CSAT_RATING_RECEIVED",
          toValue: String(body.csatScore),
        })
      }
      const labelIds = Array.isArray(body.labelIds)
        ? [...new Set(body.labelIds as string[])]
        : null

      if (labelIds !== null) {
        // Validate labelIds if provided
        const validLabels = await prisma.whatsappConversationLabel.findMany({
          where: {
            ...(!isSuper && whatsappAuth.organizationId
              ? { organizationId: whatsappAuth.organizationId }
              : {}),
            id: { in: labelIds },
          },
          select: { id: true },
        })
        if (validLabels.length !== labelIds.length) {
          set.status = 400
          return {
            ok: false,
            error: "INVALID_LABELS",
            message:
              "One or more label IDs do not belong to this organization.",
          }
        }
      }

      // Update conversation + sync labels in a transaction
      const updated = await prisma.$transaction(async (tx) => {
        if (labelIds !== null) {
          await tx.whatsappConversationLabelOnConversation.deleteMany({
            where: { conversationId: id },
          })
          if (labelIds.length > 0) {
            await tx.whatsappConversationLabelOnConversation.createMany({
              data: labelIds.map((labelId: string) => ({
                conversationId: id,
                labelId,
              })),
            })
          }
        }

        if (activitiesToCreate.length > 0) {
          await tx.whatsappConversationActivity.createMany({
            data: activitiesToCreate.map((act) => ({
              conversationId: id,
              actorId: act.actorId,
              actorName: act.actorName,
              type: act.type,
              fromValue: act.fromValue,
              toValue: act.toValue,
            })),
          })
        }

        return tx.whatsappConversation.update({
          where: { id },
          data,
          include: {
            conversationLabels: {
              include: { label: true },
            },
            activities: {
              orderBy: { createdAt: "desc" },
              take: 20,
            },
            notes: {
              orderBy: { createdAt: "desc" },
              take: 20,
            },
          },
        })
      })

      return { ok: true, conversation: updated }
    },
    {
      params: t.Object({
        id: t.String({
          example: "conv_clt1234567890",
          description: "Conversation thread ID",
        }),
      }),
      body: conversationUpdateSchema,
      detail: {
        summary: "Update Conversation Status & Stage",
        description:
          "Updates lifecycle status (OPEN/PENDING/RESOLVED), pipeline stage, assignee, or internal notes.",
        tags: ["WhatsApp Conversations"],
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
      const isSuper = isSuperAdmin(whatsappAuth)
      if (!isSuper && !whatsappAuth.organizationId) return toNoOrganization(set)
      const conversation = await prisma.whatsappConversation.findFirst({
        where: {
          id,
          ...(!isSuper && whatsappAuth.organizationId
            ? { organizationId: whatsappAuth.organizationId }
            : {}),
        },
      })

      if (!conversation) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Conversation not found.",
        }
      }

      await prisma.whatsappConversation.delete({
        where: { id },
      })
      return { ok: true, message: "Conversation deleted." }
    },
    {
      params: t.Object({
        id: t.String({
          example: "conv_clt1234567890",
          description: "Conversation thread ID",
        }),
      }),
      detail: {
        summary: "Delete Conversation Thread",
        description: "Removes a conversation thread and associated messages.",
        tags: ["WhatsApp Conversations"],
      },
    }
  )
  // ── Conversation Notes ───────────────────────────────────────────────
  .post(
    "/:id/notes",
    async ({
      request,
      params: { id },
      body,
      set,
    }: {
      request: any
      params: { id: string }
      body: { body: string; authorName?: string | null }
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const isSuper = isSuperAdmin(whatsappAuth)
      if (!isSuper && !whatsappAuth.organizationId) return toNoOrganization(set)
      const conversation = await prisma.whatsappConversation.findFirst({
        where: {
          id,
          ...(!isSuper && whatsappAuth.organizationId
            ? { organizationId: whatsappAuth.organizationId }
            : {}),
        },
      })
      if (!conversation) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Conversation not found.",
        }
      }
      const authorId =
        whatsappAuth.type === "workos"
          ? whatsappAuth.userId
          : whatsappAuth.organizationId
      const authorName =
        body.authorName ||
        (whatsappAuth.type === "workos"
          ? (whatsappAuth as any).userName || null
          : null)
      const actorId = authorId
      const actorName = authorName
      const mentions = extractMentions(body.body)
      const note = await prisma.$transaction(async (tx) => {
        const createdNote = await tx.whatsappConversationNote.create({
          data: {
            conversationId: id,
            authorId,
            authorName,
            body: body.body,
            mentions,
          },
        })

        await tx.whatsappConversationActivity.create({
          data: {
            conversationId: id,
            actorId: authorId,
            actorName,
            type: "NOTE_ADDED",
            noteId: createdNote.id,
            toValue: body.body.slice(0, 100),
          },
        })

        return createdNote
      })

      return { ok: true, note }
    },
    {
      params: t.Object({
        id: t.String({
          example: "conv_clt1234567890",
          description: "Conversation thread ID",
        }),
      }),
      body: noteBodySchema,
      detail: {
        summary: "Add Internal Team Note",
        description:
          "Adds an internal note with @mention notifications to the conversation thread.",
        tags: ["WhatsApp Conversations"],
      },
    }
  )
  // ── Conversation CSAT Survey Trigger ─────────────────────────────────
  .post(
    "/:id/csat",
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
      const isSuper = isSuperAdmin(whatsappAuth)
      if (!isSuper && !whatsappAuth.organizationId) return toNoOrganization(set)
      const conversation = await prisma.whatsappConversation.findFirst({
        where: {
          id,
          ...(!isSuper && whatsappAuth.organizationId
            ? { organizationId: whatsappAuth.organizationId }
            : {}),
        },
      })
      if (!conversation) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Conversation not found.",
        }
      }

      const actorId =
        whatsappAuth.type === "workos"
          ? whatsappAuth.userId
          : whatsappAuth.organizationId
      const actorName =
        whatsappAuth.type === "workos"
          ? (whatsappAuth as any).userName || undefined
          : undefined
      await prisma.whatsappConversationActivity.create({
        data: {
          conversationId: id,
          actorId,
          actorName,
          type: "CSAT_SURVEY_SENT",
        },
      })

      return { ok: true, message: "CSAT survey activity recorded." }
    },
    {
      params: t.Object({
        id: t.String({
          example: "conv_clt1234567890",
          description: "Conversation thread ID",
        }),
      }),
      detail: {
        summary: "Record CSAT Survey Event",
        description:
          "Records a customer satisfaction survey dispatch event in the conversation activity log.",
        tags: ["WhatsApp Conversations"],
      },
    }
  )
