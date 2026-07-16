import { Elysia, t } from "elysia"
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
  })
)

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
        },
      })

      return { ok: true, conversations }
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

      const updated = await prisma.whatsappConversation.update({
        where: { id },
        data: body,
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
