import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import {
  whatsappAuthPlugin,
  guardTenantAdmin,
} from "@/lib/whatsapp/auth"

const conversationBodySchema = t.Object({
  contactPhone: t.String({ minLength: 10, maxLength: 20 }),
  whatsappDeviceId: t.Optional(t.Nullable(t.String())),
})

const conversationUpdateSchema = t.Partial(
  t.Object({
    whatsappDeviceId: t.Nullable(t.String()),
  })
)

export const conversationsRoutes = new Elysia({ prefix: "/conversations" })
  .use(whatsappAuthPlugin)
  .get("/", guardTenantAdmin(async ({ whatsappAuth, query }: { whatsappAuth: any, query: any }) => {
    const { contactPhone } = query as any
    
    const where: any = {
      organizationId: whatsappAuth.organizationId,
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
  }))
  .get("/:id", guardTenantAdmin(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const conversation = await prisma.whatsappConversation.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId
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
  }))
  .post("/", guardTenantAdmin(async ({ body, whatsappAuth, set }: { body: any, whatsappAuth: any, set: any }) => {
    try {
      const conversation = await prisma.whatsappConversation.create({
        data: {
          ...body,
          organizationId: whatsappAuth.organizationId,
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
  }), {
    body: conversationBodySchema
  })
  .patch("/:id", guardTenantAdmin(async ({ params: { id }, body, whatsappAuth, set }: { params: { id: string }, body: any, whatsappAuth: any, set: any }) => {
    const conversation = await prisma.whatsappConversation.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId
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
  }), {
    body: conversationUpdateSchema
  })
  .delete("/:id", guardTenantAdmin(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const conversation = await prisma.whatsappConversation.findFirst({
      where: { 
        id,
        organizationId: whatsappAuth.organizationId
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
  }))
