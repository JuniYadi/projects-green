import { Elysia, t } from "elysia"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"


const DEFAULT_CONVERSATION_LIMIT = 50
const MAX_CONVERSATION_LIMIT = 100

const parseConversationLimit = (value: unknown): number => {
  const num = Number(value)
  if (!Number.isFinite(num)) return DEFAULT_CONVERSATION_LIMIT
  return Math.min(Math.max(Math.trunc(num), 1), MAX_CONVERSATION_LIMIT)
}

const toNoOrganization = (set: any) => {
  set.status = 403
  return {
    ok: false,
    error: "FORBIDDEN",
    message: "No active organization found.",
  }
}
const conversationBodySchema = t.Object({
  contactPhone: t.String({ minLength: 10, maxLength: 20 } as any),
  whatsappDeviceId: t.Optional(t.Nullable(t.String())),
})

const conversationUpdateSchema = t.Partial(
  t.Object({
    whatsappDeviceId: t.Nullable(t.String()),
    internalNotes: t.Nullable(t.String()),
    labelIds: t.Nullable(t.Array(t.String())),
  })
)

const labelBodySchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 50 }),
  color: t.Optional(t.Nullable(t.String({ maxLength: 7 }))),
})

export const conversationsRoutes = new Elysia({ prefix: "/conversations" })
  .get(
    "/",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!whatsappAuth.organizationId) return toNoOrganization(set)
      const organizationId = whatsappAuth.organizationId
      const { contactPhone, status, limit } = query as any

      const where: any = {
        organizationId,
      }

      if (contactPhone) {
        where.contactPhone = { contains: contactPhone }
      }

      // Filter conversations that have messages with the given status
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
          conversationLabels: {
            include: { label: true },
          },
        },
      })

      return { ok: true, conversations }
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
    }
  )
  .post(
    "/labels",
    async ({
      request,
      body,
      set,
    }: {
      request: any
      body: any
      set: any
    }) => {
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
  })
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
      if (!whatsappAuth.organizationId) return toNoOrganization(set)
      const organizationId = whatsappAuth.organizationId
      const conversation = await prisma.whatsappConversation.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          _count: {
            select: { whatsappMessages: true },
          },
          whatsappMessages: {
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
              statusHistory: {
                orderBy: [
                  { timestamp: "desc" },
                  { createdAt: "desc" },
                ],
              },
            },
          },
          conversationLabels: {
            include: { label: true },
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
        const conversation = await prisma.whatsappConversation.create({
          data: {
            ...body,
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
      if (!whatsappAuth.organizationId) return toNoOrganization(set)
      const organizationId = whatsappAuth.organizationId
      const conversation = await prisma.whatsappConversation.findFirst({
        where: {
          id,
          organizationId,
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
      if (body.whatsappDeviceId !== undefined) {
        data.whatsappDeviceId = body.whatsappDeviceId
      }
      if (body.internalNotes !== undefined) {
        data.internalNotes = body.internalNotes
      }

      const labelIds = Array.isArray(body.labelIds)
        ? [...new Set(body.labelIds as string[])]
        : null

      // Validate labelIds if provided
      if (labelIds !== null) {
        const validLabels = await prisma.whatsappConversationLabel.findMany({
          where: {
            organizationId,
            id: { in: labelIds },
          },
          select: { id: true },
        })
        if (validLabels.length !== labelIds.length) {
          set.status = 400
          return {
            ok: false,
            error: "INVALID_LABELS",
            message: "One or more label IDs do not belong to this organization.",
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

        return tx.whatsappConversation.update({
          where: { id },
          data,
          include: {
            conversationLabels: {
              include: { label: true },
            },
          },
        })
      })

      return { ok: true, conversation: updated }
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
      if (!whatsappAuth.organizationId) return toNoOrganization(set)
      const organizationId = whatsappAuth.organizationId
      const conversation = await prisma.whatsappConversation.findFirst({
        where: {
          id,
          organizationId,
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
    }
  )
