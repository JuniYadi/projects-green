import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { messageService } from "../messages.service"
import { toWhatsappMessageDTO } from "../messages.dto"
import { InsufficientQuotaError } from "../quota.service"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"
import {
  InsufficientBalanceError,
  QuotaExceededError,
  DailyLimitExceededError,
} from "@/modules/billing/types"

function getDailyResetAt(): string {
  const now = new Date()
  const reset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  )
  return reset.toISOString()
}

function getMonthlyResetAt(): string {
  const now = new Date()
  const reset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  )
  return reset.toISOString()
}

const messageBodySchema = t.Object({
  conversationId: t.String(),
  direction: t.Enum({ INBOX: "INBOX", OUTBOX: "OUTBOX" }),
  messageType: t.String(),
  body: t.Optional(t.Nullable(t.String())),
  mediaUrl: t.Optional(t.Nullable(t.String())),
  waMessageId: t.Optional(t.Nullable(t.String())),
  metadata: t.Optional(t.Nullable(t.Any())),
})
const sendTemplateSchema = t.Object({
  phoneNumber: t.String({ minLength: 1 }),
  templateId: t.String({ minLength: 1 }),
  templateLanguage: t.String({ minLength: 1 }),
  fields: t.Optional(t.Array(t.String())),
  deviceId: t.String({ minLength: 1 }),
})

const sendSchema = t.Object({
  phoneNumber: t.String(),
  type: t.Optional(
    t.Union([
      t.Literal("text"),
      t.Literal("image"),
      t.Literal("document"),
      t.Literal("audio"),
      t.Literal("video"),
      t.Literal("location"),
    ])
  ),
  message: t.Optional(t.String()),
  mediaUrl: t.Optional(t.String()),
  caption: t.Optional(t.String()),
  filename: t.Optional(t.String()),
  latitude: t.Optional(t.Number()),
  longitude: t.Optional(t.Number()),
  name: t.Optional(t.String()),
  address: t.Optional(t.String()),
  deviceId: t.Optional(t.String()),
})

const messageUpdateSchema = t.Partial(messageBodySchema)

function validateSendBody(body: any): string | null {
  const type = body.type ?? "text"

  if (type === "text" && !body.message) {
    return "message is required for text messages"
  }

  if (["image", "document", "audio", "video"].includes(type)) {
    if (!body.mediaUrl) {
      return "mediaUrl is required for media messages"
    }
    if (!/^https?:\/\//.test(body.mediaUrl)) {
      return "mediaUrl must be a publicly accessible http(s) URL"
    }
  }

  if (type === "location") {
    if (
      typeof body.latitude !== "number" ||
      typeof body.longitude !== "number"
    ) {
      return "latitude and longitude are required for location messages"
    }
  }

  return null
}
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )
  return { page, limit, skip: (page - 1) * limit }
}

export const messagesRoutes = new Elysia({ prefix: "/messages" })
  .get(
    "/",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const { conversationId, direction, messageType } = query as any
      const { page, limit, skip } = getPagination(query)

      const where: any = {
        conversation: {
          organizationId: whatsappAuth.organizationId!,
        },
      }

      if (conversationId) where.conversationId = conversationId
      if (direction) where.direction = direction
      if (messageType) where.messageType = messageType

      const [total, messages] = await Promise.all([
        prisma.whatsappMessage.count({ where }),
        prisma.whatsappMessage.findMany({
          where,
          include: {
            statusHistory: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ])
      const data = messages.map(toWhatsappMessageDTO)
      return {
        ok: true,
        messages: data,
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
      const message = await prisma.whatsappMessage.findFirst({
        where: {
          id,
          conversation: {
            organizationId: whatsappAuth.organizationId!,
          },
        },
        include: {
          statusHistory: true,
        },
      })

      if (!message) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Message not found." }
      }

      return { ok: true, message: toWhatsappMessageDTO(message) }
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
      // Validate conversation belongs to organization
      const conversation = await prisma.whatsappConversation.findFirst({
        where: {
          id: body.conversationId,
          organizationId: whatsappAuth.organizationId!,
        },
      })

      if (!conversation) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Conversation not found or access denied.",
        }
      }

      const message = await prisma.whatsappMessage.create({
        data: {
          ...body,
        },
      })

      return { ok: true, message: toWhatsappMessageDTO(message) }
    },
    {
      body: messageBodySchema,
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
      const message = await prisma.whatsappMessage.findFirst({
        where: {
          id,
          conversation: {
            organizationId: whatsappAuth.organizationId!,
          },
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

      return { ok: true, message: toWhatsappMessageDTO(updated) }
    },
    {
      body: messageUpdateSchema,
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
      const message = await prisma.whatsappMessage.findFirst({
        where: {
          id,
          conversation: {
            organizationId: whatsappAuth.organizationId!,
          },
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
    }
  )
  .post(
    "/send",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const validationError = validateSendBody(body)
      if (validationError) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: validationError,
        }
      }

      const {
        phoneNumber,
        type,
        message,
        mediaUrl,
        caption,
        filename,
        latitude,
        longitude,
        name,
        address,
        deviceId,
      } = body

      try {
        const result = await messageService.sendMessage({
          organizationId: whatsappAuth.organizationId!,
          phoneNumber,
          type,
          message,
          mediaUrl,
          caption,
          filename,
          latitude,
          longitude,
          name,
          address,
          deviceId,
        })

        logWhatsappAuditEvent({
          action: "MESSAGE_SENT",
          organizationId: whatsappAuth.organizationId!,
          deviceId: deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: `Message sent to ${phoneNumber}`,
          status: "OK",
          details: { waMessageId: result.waMessageId, phoneNumber, type: type ?? "text" },
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
        logWhatsappAuditEvent({
          action: "MESSAGE_FAILED",
          organizationId: whatsappAuth.organizationId!,
          deviceId: deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: "Send message failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          status: "FAILED",
        })

        if (error instanceof InsufficientBalanceError) {
          set.status = 402
          return {
            ok: false,
            error: "INSUFFICIENT_BALANCE",
            message:
              "Insufficient balance for WhatsApp messaging. Please top up your balance.",
            balance: error.available.toString(),
            estimatedCost: error.required.toString(),
          }
        }

        if (error instanceof QuotaExceededError) {
          set.status = 429
          return {
            ok: false,
            error: "MONTHLY_QUOTA_EXCEEDED",
            message: `Monthly outbound quota exceeded. Limit: ${error.monthlyLimit}, Used: ${error.monthlyUsed}`,
            resetAt: getMonthlyResetAt(),
          }
        }

        if (error instanceof DailyLimitExceededError) {
          set.status = 429
          return {
            ok: false,
            error: "DAILY_QUOTA_EXCEEDED",
            message: `Daily limit exceeded. Limit: ${error.dailyLimit}, Used: ${error.dailyUsed}`,
            resetAt: getDailyResetAt(),
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
          return {
            ok: false,
            error: "INSUFFICIENT_QUOTA",
            message: error.message,
          }
        }

        console.error("[messages] send error:", error)
        set.status = 500
        return {
          ok: false,
          error: "INTERNAL_ERROR",
          message: "Failed to send message",
        }
      }
    },
    {
      body: sendSchema,
    }
  )
  .post(
    "/send-template",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      const { phoneNumber, templateId, templateLanguage, fields, deviceId } = body as {
        phoneNumber: string
        templateId: string
        templateLanguage: string
        fields?: string[]
        deviceId: string
      }

      // Load template and verify ownership
      const template = await prisma.whatsappTemplate.findFirst({
        where: { id: templateId, organizationId: whatsappAuth.organizationId! },
        include: { languages: true },
      })

      if (!template) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Template not found." }
      }

      // Validate device is provided and matches template
      if (!deviceId) {
        set.status = 422
        return { ok: false, error: "VALIDATION_ERROR", message: "Device is required." }
      }
      if (template.whatsappDeviceId !== deviceId) {
        set.status = 422
        return { ok: false, error: "VALIDATION_ERROR", message: "Template is not available for the selected device." }
      }

      // Find the requested language
      const language = template.languages.find((l) => l.lang === templateLanguage)
      if (!language) {
        set.status = 422
        return { ok: false, error: "VALIDATION_ERROR", message: "Template language not found." }
      }

      // Extract placeholders from body and validate required fields
      const placeholderRegex = /{{\s*(\d+)\s*}}/g
      const indexes: number[] = []
      let match
      while ((match = placeholderRegex.exec(language.body ?? "")) !== null) {
        const idx = parseInt(match[1], 10)
        if (!indexes.includes(idx)) indexes.push(idx)
      }
      indexes.sort((a, b) => a - b)

      for (const index of indexes) {
        if (!fields || !fields[index - 1]?.trim()) {
          set.status = 422
          return { ok: false, error: "VALIDATION_ERROR", message: `Template field {{${index}}} is required.` }
        }
      }

      // Compute rendered body
      let renderedBody: string | null = language.body ?? null
      if (renderedBody && fields) {
        for (let i = 0; i < indexes.length; i++) {
          const idx = indexes[i]
          const val = fields[i] ?? ""
          renderedBody = renderedBody.replace(new RegExp(`{{\\s*${idx}\\s*}}`, "g"), val)
        }
      }

      try {
        const result = await messageService.sendTemplateMessage({
          organizationId: whatsappAuth.organizationId!,
          phoneNumber,
          deviceId,
          templateName: template.name,
          templateLanguage,
          fields,
          renderedBody,
          billingCategory: template.category ?? undefined,
        })

        logWhatsappAuditEvent({
          action: "MESSAGE_SENT",
          organizationId: whatsappAuth.organizationId!,
          deviceId: deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: `Template message sent to ${phoneNumber}`,
          status: "OK",
          details: { waMessageId: result.waMessageId, phoneNumber, templateName: template.name, templateLanguage },
        })

        return {
          ok: true,
          jobId: result.jobId,
          messageId: result.messageId,
          waMessageId: result.waMessageId,
          status: result.status,
        }
      } catch (error) {
        logWhatsappAuditEvent({
          action: "MESSAGE_FAILED",
          organizationId: whatsappAuth.organizationId!,
          deviceId: deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: "Send template message failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          status: "FAILED",
        })

        if (error instanceof InsufficientBalanceError) {
          set.status = 402
          return {
            ok: false,
            error: "INSUFFICIENT_BALANCE",
            message: "Insufficient balance for WhatsApp messaging.",
            balance: error.available.toString(),
            estimatedCost: error.required.toString(),
          }
        }

        if (error instanceof QuotaExceededError) {
          set.status = 429
          return {
            ok: false,
            error: "MONTHLY_QUOTA_EXCEEDED",
            message: `Monthly outbound quota exceeded. Limit: ${error.monthlyLimit}, Used: ${error.monthlyUsed}`,
            resetAt: getMonthlyResetAt(),
          }
        }

        if (error instanceof DailyLimitExceededError) {
          set.status = 429
          return {
            ok: false,
            error: "DAILY_QUOTA_EXCEEDED",
            message: `Daily limit exceeded.`,
            resetAt: getDailyResetAt(),
          }
        }

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
          return {
            ok: false,
            error: "INSUFFICIENT_QUOTA",
            message: error.message,
          }
        }

        console.error("[messages] send-template error:", error)
        set.status = 500
        return {
          ok: false,
          error: "INTERNAL_ERROR",
          message: "Failed to send template message",
        }
      }
    },
    {
      body: sendTemplateSchema,
    }
  )
  .post(
    "/send-interactive",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      const { phoneNumber, deviceId, interactive } = body as {
        phoneNumber: string
        deviceId?: string
        interactive: { type: "button" | "list"; [key: string]: unknown }
      }

      try {
        const result = await messageService.sendMessage({
          organizationId: whatsappAuth.organizationId!,
          phoneNumber,
          type: "interactive",
          interactivePayload: interactive as Record<string, unknown>,
          deviceId,
        })

        logWhatsappAuditEvent({
          action: "MESSAGE_SENT",
          organizationId: whatsappAuth.organizationId!,
          deviceId: deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: `Interactive message sent to ${phoneNumber}`,
          status: "OK",
          details: { waMessageId: result.waMessageId, phoneNumber, interactiveType: interactive.type },
        })

        return {
          ok: true,
          jobId: result.jobId,
          messageId: result.messageId,
          waMessageId: result.waMessageId,
          status: result.status,
        }
      } catch (error) {
        logWhatsappAuditEvent({
          action: "MESSAGE_FAILED",
          organizationId: whatsappAuth.organizationId!,
          deviceId: deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: "Send interactive message failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          status: "FAILED",
        })

        if (error instanceof InsufficientBalanceError) {
          set.status = 402
          return {
            ok: false,
            error: "INSUFFICIENT_BALANCE",
            message: "Insufficient balance for WhatsApp messaging.",
            balance: error.available.toString(),
            estimatedCost: error.required.toString(),
          }
        }

        if (error instanceof QuotaExceededError) {
          set.status = 429
          return {
            ok: false,
            error: "MONTHLY_QUOTA_EXCEEDED",
            message: `Monthly outbound quota exceeded. Limit: ${error.monthlyLimit}, Used: ${error.monthlyUsed}`,
            resetAt: getMonthlyResetAt(),
          }
        }

        if (error instanceof DailyLimitExceededError) {
          set.status = 429
          return {
            ok: false,
            error: "DAILY_QUOTA_EXCEEDED",
            message: `Daily limit exceeded. Limit: ${error.dailyLimit}, Used: ${error.dailyUsed}`,
            resetAt: getDailyResetAt(),
          }
        }

        console.error("[messages] send-interactive error:", error)
        set.status = 500
        return {
          ok: false,
          error: "INTERNAL_ERROR",
          message: "Failed to send interactive message",
        }
      }
    },
    {
      body: t.Object({
        phoneNumber: t.String({ minLength: 1 }),
        deviceId: t.Optional(t.String()),
        interactive: t.Union([
          t.Object({
            type: t.Literal("button"),
            header: t.Optional(
              t.Object({
                type: t.String(),
                text: t.String({ maxLength: 60 }),
              })
            ),
            body: t.Object({
              text: t.String({ minLength: 1, maxLength: 1024 }),
            }),
            footer: t.Optional(
              t.Object({
                text: t.String({ maxLength: 60 }),
              })
            ),
            action: t.Object({
              buttons: t.Array(
                t.Union([
                  t.Object({
                    type: t.Literal("reply"),
                    reply: t.Object({
                      id: t.String(),
                      title: t.String({ maxLength: 20 }),
                    }),
                  }),
                  t.Object({
                    type: t.Literal("cta_url"),
                    cta_url: t.Object({
                      url: t.String(),
                      display_text: t.String(),
                    }),
                  }),
                ])
              ),
            }),
          }),
          t.Object({
            type: t.Literal("list"),
            header: t.Optional(
              t.Object({
                type: t.String(),
                text: t.String({ maxLength: 60 }),
              })
            ),
            body: t.Object({
              text: t.String({ minLength: 1, maxLength: 1024 }),
            }),
            footer: t.Optional(
              t.Object({
                text: t.String({ maxLength: 60 }),
              })
            ),
            action: t.Object({
              button: t.String(),
              sections: t.Array(
                t.Object({
                  title: t.Optional(t.String({ maxLength: 24 })),
                  rows: t.Array(
                    t.Object({
                      id: t.String(),
                      title: t.String({ maxLength: 24 }),
                      description: t.Optional(t.String()),
                    })
                  ),
                })
              ),
            }),
          }),
        ]),
      }),
    }
  )
  .get(
    "/:id/media",
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
      // Find message with media
      const message = await prisma.whatsappMessage.findFirst({
        where: {
          id,
          conversation: {
            organizationId: whatsappAuth.organizationId!,
          },
        },
        include: {
          conversation: {
            include: {
              whatsappDevice: true,
            },
          },
        },
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
          return {
            ok: false,
            error: "NO_DEVICE_TOKEN",
            message: "Device not configured",
          }
        }

        return {
          ok: true,
          mediaId,
          downloadUrl: `/api/whatsapp/media/${mediaId}?deviceId=${device.id}`,
        }
      }

      // Return existing public URL
      return {
        ok: true,
        mediaUrl: message.mediaUrl,
      }
    }
  )
