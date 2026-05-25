import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import {
  whatsappAuthPlugin,
  guardTenantAdmin,
} from "@/lib/whatsapp/auth"

const messageBodySchema = t.Object({
  conversationId: t.String(),
  direction: t.Enum({ INBOX: "INBOX", OUTBOX: "OUTBOX" }),
  messageType: t.String(),
  body: t.Optional(t.Nullable(t.String())),
  mediaUrl: t.Optional(t.Nullable(t.String())),
  waMessageId: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(t.Nullable(t.Any())),
})

const sendSchema = t.Object({
  phoneNumber: t.String(),
  message: t.String(),
  deviceId: t.Optional(t.String()),
})

const messageUpdateSchema = t.Partial(messageBodySchema)

export const messagesRoutes = new Elysia({ prefix: "/messages" })
  .use(whatsappAuthPlugin)
  .get("/", guardTenantAdmin(async ({ whatsappAuth, query }: { whatsappAuth: any, query: any }) => {
    const { conversationId, direction, messageType } = query as any
    
    const where: any = {
      conversation: {
        organizationId: whatsappAuth.organizationId,
      }
    }

    if (conversationId) where.conversationId = conversationId
    if (direction) where.direction = direction
    if (messageType) where.messageType = messageType

    const messages = await prisma.whatsappMessage.findMany({
      where,
      include: {
        statusHistory: true
      },
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, messages }
  }))
  .get("/:id", guardTenantAdmin(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const message = await prisma.whatsappMessage.findFirst({
      where: { 
        id,
        conversation: {
          organizationId: whatsappAuth.organizationId
        }
      },
      include: {
        statusHistory: true
      }
    })

    if (!message) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Message not found." }
    }

    return { ok: true, message }
  }))
  .post("/", guardTenantAdmin(async ({ body, whatsappAuth, set }: { body: any, whatsappAuth: any, set: any }) => {
    // Validate conversation belongs to organization
    const conversation = await prisma.whatsappConversation.findFirst({
      where: {
        id: body.conversationId,
        organizationId: whatsappAuth.organizationId
      }
    })

    if (!conversation) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Conversation not found or access denied." }
    }

    const message = await prisma.whatsappMessage.create({
      data: {
        ...body,
      },
    })

    return { ok: true, message }
  }), {
    body: messageBodySchema
  })
  .patch("/:id", guardTenantAdmin(async ({ params: { id }, body, whatsappAuth, set }: { params: { id: string }, body: any, whatsappAuth: any, set: any }) => {
    const message = await prisma.whatsappMessage.findFirst({
      where: { 
        id,
        conversation: {
          organizationId: whatsappAuth.organizationId
        }
      },
    })

    if (!message) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Message not found." }
    }

    const updated = await prisma.whatsappMessage.update({
      where: { id },
      data: body,
    })

    return { ok: true, message: updated }
  }), {
    body: messageUpdateSchema
  })
  .delete("/:id", guardTenantAdmin(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const message = await prisma.whatsappMessage.findFirst({
      where: { 
        id,
        conversation: {
          organizationId: whatsappAuth.organizationId
        }
      },
    })

    if (!message) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Message not found." }
    }

    await prisma.whatsappMessage.delete({
      where: { id },
    })
    return { ok: true, message: "Message deleted." }
  }))
  .post("/send", guardTenantAdmin(async () => {
    // Stub endpoint for sending message
    return { 
      messageId: `stub_${Date.now()}`, 
      status: "queued" 
    }
  }), {
    body: sendSchema
  })
