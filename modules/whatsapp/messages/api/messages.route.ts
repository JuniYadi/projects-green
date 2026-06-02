import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { messageService } from "../messages.service"
import { InsufficientQuotaError } from "../quota.service"
import {
  InsufficientBalanceError,
  QuotaExceededError,
  DailyLimitExceededError,
} from "@/modules/billing/types"

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
  .get("/", async ({ request, set, query }: { request: any, set: any, query: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const { conversationId, direction, messageType } = query as any

    const where: any = {
      conversation: {
        organizationId: whatsappAuth.organizationId!,
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
  })
  .get("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const message = await prisma.whatsappMessage.findFirst({
      where: {
        id,
        conversation: {
          organizationId: whatsappAuth.organizationId!
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
  })
  .post("/", async ({ request, body, set }: { request: any, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    // Validate conversation belongs to organization
    const conversation = await prisma.whatsappConversation.findFirst({
      where: {
        id: body.conversationId,
        organizationId: whatsappAuth.organizationId!
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
  }, {
    body: messageBodySchema
  })
  .patch("/:id", async ({ request, params: { id }, body, set }: { request: any, params: { id: string }, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const message = await prisma.whatsappMessage.findFirst({
      where: {
        id,
        conversation: {
          organizationId: whatsappAuth.organizationId!
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
  }, {
    body: messageUpdateSchema
  })
  .delete("/:id", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const message = await prisma.whatsappMessage.findFirst({
      where: {
        id,
        conversation: {
          organizationId: whatsappAuth.organizationId!
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
  })
  .post("/send", async ({ request, body, set }: { request: any, body: any, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    const { phoneNumber, message, deviceId } = body

    try {
      const result = await messageService.sendMessage({
        organizationId: whatsappAuth.organizationId!,
        phoneNumber,
        message,
        deviceId,
      })

      return {
        ok: true,
        jobId: result.jobId,
        messageId: result.messageId,
        waMessageId: result.waMessageId,
        status: result.status,
      }
    } catch (error) {
      // Handle billing-related errors with appropriate HTTP status codes
      if (error instanceof InsufficientBalanceError) {
        set.status = 402
        return {
          ok: false,
          error: "INSUFFICIENT_BALANCE",
          message: "Insufficient balance for WhatsApp messaging. Please top up your balance.",
        }
      }

      if (error instanceof QuotaExceededError) {
        set.status = 429
        return {
          ok: false,
          error: "QUOTA_EXCEEDED",
          message: `Monthly outbound quota exceeded. Limit: ${error.monthlyLimit}, Used: ${error.monthlyUsed}`,
        }
      }

      if (error instanceof DailyLimitExceededError) {
        set.status = 429
        return {
          ok: false,
          error: "DAILY_LIMIT_EXCEEDED",
          message: `Daily limit exceeded. Limit: ${error.dailyLimit}, Used: ${error.dailyUsed}`,
        }
      }

      // Handle "NO_BILLING_ACCOUNT" error - org has no billing setup
      if (error instanceof Error && error.message === "NO_BILLING_ACCOUNT") {
        set.status = 400
        return {
          ok: false,
          error: "BILLING_NOT_CONFIGURED",
          message: "No billing account configured for this organization.",
        }
      }

      if (error instanceof InsufficientQuotaError) {
        set.status = 422
        return { ok: false, error: "INSUFFICIENT_QUOTA", message: error.message }
      }

      console.error("[messages] send error:", error)
      set.status = 500
      return { ok: false, error: "INTERNAL_ERROR", message: "Failed to send message" }
    }
  }, {
    body: sendSchema
  })
  .get("/:id/media", async ({ request, params: { id }, set }: { request: any, params: { id: string }, set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }
    // Find message with media
    const message = await prisma.whatsappMessage.findFirst({
      where: {
        id,
        conversation: {
          organizationId: whatsappAuth.organizationId!
        }
      },
      include: {
        conversation: {
          include: {
            whatsappDevice: true
          }
        }
      }
    })

    if (!message || !message.mediaUrl) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Media not found" }
    }

    // If media is a Meta media ID, return download URL
    if (message.mediaUrl.startsWith("__media:")) {
      const mediaId = message.mediaUrl.replace("__media:", "")
      const device = message.conversation.whatsappDevice

      if (!device?.tokenEncrypted) {
        set.status = 500
        return { ok: false, error: "NO_DEVICE_TOKEN", message: "Device not configured" }
      }

      return {
        ok: true,
        mediaId,
        downloadUrl: `/api/whatsapp/media/${mediaId}?deviceId=${device.id}`
      }
    }

    // Return existing public URL
    return {
      ok: true,
      mediaUrl: message.mediaUrl
    }
  })
