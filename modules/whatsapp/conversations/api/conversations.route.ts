import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

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
  .get("/", async ({ request, set, query }: { request: any, set: any, query: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const { contactPhone } = query as any
    
    const where: any = {
      organizationId: whatsappAuth.organizationId!,
    }

    if (contactPhone) {
      where.contactPhone = { contains: contactPhone }
    }

    const conversations = await prisma.whatsappConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      include: {
        _count: {
          select: { whatsappMessages: true }
        }
      }
    })
    
    return { ok: true, conversations }
  })
  .get("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const conversation = await prisma.whatsappConversation.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId!
      },
      include: {
        whatsappMessages: {
          orderBy: { createdAt: "desc" },
          take: 50,
        }
      }
    })

    if (!conversation) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Conversation not found." }
    }

    return { ok: true, conversation }
  })
  .post("/", async ({ request, body, set }: { request: any, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    try {
      const conversation = await prisma.whatsappConversation.create({
        data: {
          ...body,
          organizationId: whatsappAuth.organizationId!,
        },
      })

      return { ok: true, conversation }
    } catch (error: any) {
      if (error.code === "P2002") {
        set.status = 400
        return { ok: false, error: "ALREADY_EXISTS", message: "Conversation with this phone already exists." }
      }
      throw error
    }
  }, {
    body: conversationBodySchema
  })
  .patch("/:id", async ({ request, params: { id }, body, set }: { request: any, params: { id: string }, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const conversation = await prisma.whatsappConversation.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId!
      },
    })

    if (!conversation) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Conversation not found." }
    }

    const updated = await prisma.whatsappConversation.update({
      where: { id },
      data: body,
    })

    return { ok: true, conversation: updated }
  }, {
    body: conversationUpdateSchema
  })
  .delete("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const conversation = await prisma.whatsappConversation.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId!
      },
    })

    if (!conversation) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Conversation not found." }
    }

    await prisma.whatsappConversation.delete({
      where: { id },
    })
    
    return { ok: true, message: "Conversation deleted." }
  })
