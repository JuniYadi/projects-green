import { getCachedUser } from "@/lib/workos-directory"
import { Elysia, t } from "elysia"
import type { InteractivePayload } from "@/lib/whatsapp/meta-cloud/types"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { messageService } from "../messages.service"
import { toWhatsappMessageDTO, toWhatsappSendResultDTO } from "../messages.dto"
import { toWhatsappMessagePricingDTO } from "../message-pricing.dto"
import { WhatsappMessagePricingService } from "../message-pricing.service"
import {
  WhatsappSendFailedError,
  WhatsappSessionWindowClosedError,
  UnsupportedDestinationCountryError,
} from "../messages.errors"
import type { WhatsAppTemplateLanguage } from "@/lib/api/whatsapp-client"
import { InsufficientQuotaError } from "../quota.service"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"
import { normalizeIndonesianPhoneNumber } from "@/modules/whatsapp/messages/phone-number"
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
  .get("/pricing", async ({ request, set }: { request: any; set: any }) => {
    const whatsappAuth = await resolveAuthContext(request)
    if (!whatsappAuth) {
      set.status = 401
      return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
    }

    const pricing = await new WhatsappMessagePricingService(prisma).getPricing(
      whatsappAuth.organizationId!
    )
    return { ok: true, ...toWhatsappMessagePricingDTO(pricing) }
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
    "/internal",
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
  .post(
    "/",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }

      // 1. Resolve recipient phone number (supports 'phoneNumber' and legacy 'phone')
      const rawPhone = body.phoneNumber ?? body.phone
      if (!rawPhone || typeof rawPhone !== "string") {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Phone number is required.",
        }
      }
      const normalizedPhone = normalizeIndonesianPhoneNumber(rawPhone)
      if (!normalizedPhone) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message:
            "Phone number must be in E.164 format or Indonesian local format.",
        }
      }

      // 2. Dispatch: Template Message (PFNApp format or KrmPesan legacy format)
      const hasTemplatePayload =
        Boolean(body.template_name) ||
        Boolean(body.templateId) ||
        Boolean(body.template)

      if (hasTemplatePayload) {
        let templateName = body.template_name ?? body.templateName
        let templateLanguage =
          body.template_language ?? body.templateLanguage ?? "id"
        let fields: string[] = Array.isArray(body.fields) ? body.fields : []
        let deviceId: string | undefined =
          body.deviceId ?? body.whatsappDeviceId

        // Support legacy KrmPesan template object structure
        if (body.template && typeof body.template === "object") {
          if (Array.isArray(body.template.body)) {
            fields = body.template.body.map((v: unknown) => String(v))
          }
        }

        // Lookup template by templateId or templateName
        const template = await prisma.whatsappTemplate.findFirst({
          where: {
            organizationId: whatsappAuth.organizationId!,
            ...(body.templateId
              ? { id: body.templateId }
              : { name: templateName }),
          },
          include: { languages: true },
        })

        if (!template) {
          set.status = 404
          return {
            ok: false,
            error: "NOT_FOUND",
            message: "Template not found.",
          }
        }

        templateName = template.name
        deviceId = deviceId || template.whatsappDeviceId || undefined

        if (!deviceId) {
          set.status = 422
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "Device is required.",
          }
        }

        if (template.whatsappDeviceId !== deviceId) {
          set.status = 422
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "Template is not available for the selected device.",
          }
        }

        // Resolve template language
        const language =
          template.languages.find((l) => l.lang === templateLanguage) ||
          template.languages[0]

        if (!language) {
          set.status = 422
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: "Template language not found.",
          }
        }
        templateLanguage = language.lang

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
            return {
              ok: false,
              error: "VALIDATION_ERROR",
              message: `Template field {{${index}}} is required.`,
            }
          }
        }

        let renderedBody: string | null = language.body ?? null
        if (renderedBody && fields) {
          for (let i = 0; i < indexes.length; i++) {
            const idx = indexes[i]
            const val = fields[i] ?? ""
            renderedBody = renderedBody.replace(
              new RegExp(`{{\\s*${idx}\\s*}}`, "g"),
              val
            )
          }
        }

        try {
          const result = await messageService.sendTemplateMessage({
            organizationId: whatsappAuth.organizationId!,
            phoneNumber: normalizedPhone,
            deviceId,
            templateName,
            templateLanguage,
            fields,
            renderedBody,
            billingCategory: template.category ?? undefined,
            templateLanguageData:
              language as unknown as WhatsAppTemplateLanguage,
          })
          const response = toWhatsappSendResultDTO(result)

          logWhatsappAuditEvent({
            action: "MESSAGE_SENT",
            organizationId: whatsappAuth.organizationId!,
            deviceId: deviceId ?? null,
            adminId: (whatsappAuth as any).userId,
            message: `Template message sent to ${normalizedPhone}`,
            status: "OK",
            details: {
              waMessageId: response.waMessageId,
              phoneNumber: normalizedPhone,
              templateName,
              templateLanguage,
            },
          })

          return { ok: true, ...response }
        } catch (error) {
          logWhatsappAuditEvent({
            action: "MESSAGE_FAILED",
            organizationId: whatsappAuth.organizationId!,
            deviceId: deviceId ?? null,
            adminId: (whatsappAuth as any).userId,
            message: "Send template message failed",
            errorMessage:
              error instanceof Error ? error.message : String(error),
            status: "FAILED",
          })

          if (error instanceof WhatsappSendFailedError) {
            set.status = 502
            return {
              ok: false,
              error: "WHATSAPP_SEND_FAILED",
              message: error.message,
              messageId: error.messageId,
            }
          }
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
          if (
            error instanceof Error &&
            (error.message === "NO_BILLING_ACCOUNT" ||
              error.message === "BILLING_ACCOUNT_NOT_FOUND")
          ) {
            set.status = 400
            return {
              ok: false,
              error: "BILLING_NOT_CONFIGURED",
              message: "No billing account configured for this organization.",
            }
          }
          if (error instanceof UnsupportedDestinationCountryError) {
            set.status = 422
            return {
              ok: false,
              error: "UNSUPPORTED_DESTINATION_COUNTRY",
              message: error.message,
              country: error.country,
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

          console.error("[messages] unified template send error:", error)
          set.status = 500
          return {
            ok: false,
            error: "INTERNAL_ERROR",
            message: "Failed to send template message",
          }
        }
      }

      // 3. Dispatch: Free-form Message (Text / Media / Location)
      const textMessage = body.message ?? body.text?.body ?? body.text
      const mediaUrl = body.mediaUrl ?? body.media_url
      const type = body.type ?? "text"

      if (typeof textMessage !== "string" && type === "text") {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "message is required for text messages",
        }
      }

      try {
        const result = await messageService.sendMessage({
          organizationId: whatsappAuth.organizationId!,
          phoneNumber: normalizedPhone,
          type,
          message: textMessage,
          mediaUrl,
          caption: body.caption,
          filename: body.filename,
          latitude: body.latitude,
          longitude: body.longitude,
          name: body.name,
          address: body.address,
          deviceId: body.deviceId,
        })
        const response = toWhatsappSendResultDTO(result)

        logWhatsappAuditEvent({
          action: "MESSAGE_SENT",
          organizationId: whatsappAuth.organizationId!,
          deviceId: body.deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: `Message sent to ${normalizedPhone}`,
          status: "OK",
          details: {
            waMessageId: response.waMessageId,
            phoneNumber: normalizedPhone,
            type: type ?? "text",
          },
        })

        return { ok: true, ...response }
      } catch (error) {
        logWhatsappAuditEvent({
          action: "MESSAGE_FAILED",
          organizationId: whatsappAuth.organizationId!,
          deviceId: body.deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: "Send message failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          status: "FAILED",
        })

        if (error instanceof WhatsappSendFailedError) {
          set.status = 502
          return {
            ok: false,
            error: "WHATSAPP_SEND_FAILED",
            message: error.message,
            messageId: error.messageId,
          }
        }
        if (error instanceof WhatsappSessionWindowClosedError) {
          set.status = 422
          return {
            ok: false,
            error: "WHATSAPP_TEMPLATE_REQUIRED",
            message: error.message,
          }
        }
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
        if (
          error instanceof Error &&
          (error.message === "NO_BILLING_ACCOUNT" ||
            error.message === "BILLING_ACCOUNT_NOT_FOUND")
        ) {
          set.status = 400
          return {
            ok: false,
            error: "BILLING_NOT_CONFIGURED",
            message: "No billing account configured for this organization.",
          }
        }
        if (error instanceof UnsupportedDestinationCountryError) {
          set.status = 422
          return {
            ok: false,
            error: "UNSUPPORTED_DESTINATION_COUNTRY",
            message: error.message,
            country: error.country,
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

        console.error("[messages] unified free-form send error:", error)
        set.status = 500
        return {
          ok: false,
          error: "INTERNAL_ERROR",
          message: "Failed to send message",
        }
      }
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
      const normalizedPhone = normalizeIndonesianPhoneNumber(body.phoneNumber)
      if (!normalizedPhone) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message:
            "Phone number must be in E.164 format or Indonesian local format.",
        }
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
          phoneNumber: normalizedPhone,
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
        const response = toWhatsappSendResultDTO(result)

        logWhatsappAuditEvent({
          action: "MESSAGE_SENT",
          organizationId: whatsappAuth.organizationId!,
          deviceId: deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: `Message sent to ${normalizedPhone}`,
          status: "OK",
          details: {
            waMessageId: response.waMessageId,
            phoneNumber: normalizedPhone,
            type: type ?? "text",
          },
        })

        return {
          ok: true,
          ...response,
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

        if (error instanceof WhatsappSendFailedError) {
          set.status = 502
          return {
            ok: false,
            error: "WHATSAPP_SEND_FAILED",
            message: error.message,
            messageId: error.messageId,
          }
        }

        if (error instanceof WhatsappSessionWindowClosedError) {
          set.status = 422
          return {
            ok: false,
            error: "WHATSAPP_TEMPLATE_REQUIRED",
            message: error.message,
          }
        }

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

        // Handle "NO_BILLING_ACCOUNT" / "BILLING_ACCOUNT_NOT_FOUND" — org has no billing setup
        if (
          error instanceof Error &&
          (error.message === "NO_BILLING_ACCOUNT" ||
            error.message === "BILLING_ACCOUNT_NOT_FOUND")
        ) {
          set.status = 400
          return {
            ok: false,
            error: "BILLING_NOT_CONFIGURED",
            message: "No billing account configured for this organization.",
          }
        }
        if (error instanceof UnsupportedDestinationCountryError) {
          set.status = 422
          return {
            ok: false,
            error: "UNSUPPORTED_DESTINATION_COUNTRY",
            message: error.message,
            country: error.country,
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
      const normalizedPhone = normalizeIndonesianPhoneNumber(body.phoneNumber)
      if (!normalizedPhone) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message:
            "Phone number must be in E.164 format or Indonesian local format.",
        }
      }

      const { phoneNumber, templateId, templateLanguage, fields, deviceId } =
        body as {
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
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Device is required.",
        }
      }
      if (template.whatsappDeviceId !== deviceId) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Template is not available for the selected device.",
        }
      }

      // Find the requested language
      const language = template.languages.find(
        (l) => l.lang === templateLanguage
      )
      if (!language) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Template language not found.",
        }
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
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message: `Template field {{${index}}} is required.`,
          }
        }
      }

      // Compute rendered body
      let renderedBody: string | null = language.body ?? null
      if (renderedBody && fields) {
        for (let i = 0; i < indexes.length; i++) {
          const idx = indexes[i]
          const val = fields[i] ?? ""
          renderedBody = renderedBody.replace(
            new RegExp(`{{\\s*${idx}\\s*}}`, "g"),
            val
          )
        }
      }
      try {
        const result = await messageService.sendTemplateMessage({
          organizationId: whatsappAuth.organizationId!,
          phoneNumber: normalizedPhone,
          deviceId,
          templateName: template.name,
          templateLanguage,
          fields,
          renderedBody,
          billingCategory: template.category ?? undefined,
          templateLanguageData: language as unknown as WhatsAppTemplateLanguage,
        })
        const response = toWhatsappSendResultDTO(result)

        logWhatsappAuditEvent({
          action: "MESSAGE_SENT",
          organizationId: whatsappAuth.organizationId!,
          deviceId: deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: `Template message sent to ${normalizedPhone}`,
          status: "OK",
          details: {
            waMessageId: response.waMessageId,
            phoneNumber: normalizedPhone,
            templateName: template.name,
            templateLanguage,
          },
        })

        return {
          ok: true,
          ...response,
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

        if (error instanceof WhatsappSendFailedError) {
          set.status = 502
          return {
            ok: false,
            error: "WHATSAPP_SEND_FAILED",
            message: error.message,
            messageId: error.messageId,
          }
        }

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

        // Handle "NO_BILLING_ACCOUNT" / "BILLING_ACCOUNT_NOT_FOUND" — org has no billing setup
        if (
          error instanceof Error &&
          (error.message === "NO_BILLING_ACCOUNT" ||
            error.message === "BILLING_ACCOUNT_NOT_FOUND")
        ) {
          set.status = 400
          return {
            ok: false,
            error: "BILLING_NOT_CONFIGURED",
            message: "No billing account configured for this organization.",
          }
        }

        if (error instanceof UnsupportedDestinationCountryError) {
          set.status = 422
          return {
            ok: false,
            error: "UNSUPPORTED_DESTINATION_COUNTRY",
            message: error.message,
            country: error.country,
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
      const normalizedPhone = normalizeIndonesianPhoneNumber(body.phoneNumber)
      if (!normalizedPhone) {
        set.status = 422
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message:
            "Phone number must be in E.164 format or Indonesian local format.",
        }
      }

      const { deviceId, interactive } = body as {
        deviceId?: string
        interactive: { type: "button" | "list"; [key: string]: unknown }
      }

      try {
        const result = await messageService.sendMessage({
          organizationId: whatsappAuth.organizationId!,
          phoneNumber: normalizedPhone,
          type: "interactive",
          interactivePayload: interactive as unknown as InteractivePayload,
          deviceId,
        })
        const response = toWhatsappSendResultDTO(result)

        logWhatsappAuditEvent({
          action: "MESSAGE_SENT",
          organizationId: whatsappAuth.organizationId!,
          deviceId: deviceId ?? null,
          adminId: (whatsappAuth as any).userId,
          message: `Interactive message sent to ${normalizedPhone}`,
          status: "OK",
          details: {
            waMessageId: response.waMessageId,
            phoneNumber: normalizedPhone,
            interactiveType: interactive.type,
          },
        })

        return {
          ok: true,
          ...response,
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

        if (error instanceof WhatsappSessionWindowClosedError) {
          set.status = 422
          return {
            ok: false,
            error: "WHATSAPP_TEMPLATE_REQUIRED",
            message: error.message,
          }
        }

        if (error instanceof WhatsappSendFailedError) {
          set.status = 502
          return {
            ok: false,
            error: "WHATSAPP_SEND_FAILED",
            message: error.message,
            messageId: error.messageId,
          }
        }

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
  .get(
    "/journey/:waMessageId",
    async ({ request, params: { waMessageId }, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required.",
        }
      }

      const decodedWamid = decodeURIComponent(waMessageId)

      // 1. Query message record
      const message = await prisma.whatsappMessage.findFirst({
        where: {
          waMessageId: decodedWamid,
          conversation: {
            organizationId: auth.organizationId,
          },
        },
        include: {
          conversation: {
            include: {
              whatsappDevice: true,
            },
          },
          statusHistory: {
            orderBy: { createdAt: "asc" },
          },
        },
      })

      // 2. Query billing ledger
      const billingLedger = await prisma.whatsappBillingLedger.findFirst({
        where: {
          waMessageId: decodedWamid,
          organizationId: auth.organizationId,
        },
      })

      // 3. Query audit log by structured message ID.
      // Message text can contain a wamid from an unrelated message and create
      // a false journey link.
      const auditLog = await prisma.whatsappAuditLog.findFirst({
        where: {
          organizationId: auth.organizationId,
          details: { path: ["waMessageId"], equals: decodedWamid },
        },
        orderBy: { createdAt: "asc" },
      })

      // 4. Query webhook events
      const webhookEvents = await prisma.whatsappWebhookEvent.findMany({
        where: {
          waMessageId: decodedWamid,
          organizationId: auth.organizationId,
        },
        orderBy: { createdAt: "asc" },
      })

      if (
        !message &&
        !billingLedger &&
        webhookEvents.length === 0 &&
        !auditLog
      ) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Message not found" }
      }

      // Build chronological timeline
      const timeline: Array<{
        id: string
        status: string
        timestamp: string
        error: string | null
        label: string
        description?: string
      }> = []

      // The message record is the initiation event. Billing may be reserved
      // before it, so sorting below can intentionally place billing first.
      const createdAt =
        message?.createdAt ??
        auditLog?.createdAt ??
        billingLedger?.createdAt ??
        new Date()
      timeline.push({
        id: "step-initiation",
        status: "INITIATED",
        timestamp: createdAt.toISOString(),
        error: null,
        label: "Message Initiated",
        description:
          auditLog?.message ??
          (message
            ? `Direction: ${message.direction}`
            : "Webhook event received"),
      })

      // Billing Step
      if (billingLedger) {
        timeline.push({
          id: `step-billing-${billingLedger.id}`,
          status: billingLedger.status,
          timestamp: billingLedger.createdAt.toISOString(),
          error: null,
          label: "Quota & Billing Recorded",
          description: `Category: ${billingLedger.category} · Status: ${billingLedger.status}`,
        })
      }

      // Status History Steps
      if (message?.statusHistory && message.statusHistory.length > 0) {
        for (const st of message.statusHistory) {
          timeline.push({
            id: st.id,
            status: st.status,
            timestamp: (st.timestamp ?? st.createdAt).toISOString(),
            error: st.error ?? null,
            label: `Delivery Status: ${st.status}`,
            description: st.error ? `Error: ${st.error}` : undefined,
          })
        }
      }

      // Webhook Dispatch Steps
      for (const we of webhookEvents) {
        timeline.push({
          id: `step-webhook-${we.id}`,
          status: we.processingStatus,
          timestamp: we.createdAt.toISOString(),
          error: we.errorMessage ?? null,
          label: `Webhook Received (${we.eventType})`,
          description: `Processing: ${we.processingStatus}`,
        })
      }
      timeline.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))

      const device = message?.conversation.whatsappDevice
      const auditDetails =
        auditLog?.details && typeof auditLog.details === "object"
          ? (auditLog.details as Record<string, unknown>)
          : null
      const contactPhone =
        message?.conversation.contactPhone ??
        billingLedger?.phoneNumber ??
        (typeof auditDetails?.phoneNumber === "string"
          ? auditDetails.phoneNumber
          : "")

      let origin = "Direct API"
      if (auditLog) {
        if (
          auditLog.userAgent &&
          /mozilla|chrome|safari|firefox/i.test(auditLog.userAgent)
        ) {
          origin = "Console UI"
        } else if (auditLog.action === "BROADCAST_SENT") {
          origin = "Broadcast Campaign"
        } else {
          origin = "API Key Request"
        }
      }

      const deviceProfile =
        device?.whatsappProfile && typeof device.whatsappProfile === "object"
          ? (device.whatsappProfile as Record<string, unknown>)
          : null

      const auditActor = auditLog?.adminId
        ? await getCachedUser(auditLog.adminId)
        : null
      return {
        ok: true,
        data: {
          message: message
            ? {
                id: message.id,
                conversationId: message.conversationId,
                direction: message.direction,
                messageType: message.messageType,
                body: message.body,
                mediaUrl: message.mediaUrl,
                waMessageId: message.waMessageId,
                metadata: message.metadata as Record<string, unknown> | null,
                createdAt: message.createdAt.toISOString(),
              }
            : {
                id: "",
                conversationId: "",
                direction: "OUTBOX",
                messageType: "template",
                body: auditLog?.message ?? "Message",
                mediaUrl: null,
                waMessageId: decodedWamid,
                metadata: auditDetails,
                createdAt: createdAt.toISOString(),
              },
          device: device
            ? {
                id: device.id,
                phoneNumber: device.phoneNumber,
                name:
                  typeof deviceProfile?.name === "string"
                    ? deviceProfile.name
                    : null,
                environment: null,
              }
            : null,
          contact: contactPhone
            ? {
                phoneNumber: contactPhone,
                waId: null,
              }
            : null,
          billing: billingLedger
            ? {
                category: billingLedger.category,
                quotaKey: billingLedger.quotaKey,
                status: billingLedger.status,
                createdAt: billingLedger.createdAt.toISOString(),
              }
            : null,
          audit: auditLog
            ? {
                adminId: auditLog.adminId,
                actorName: auditLog.adminId
                  ? (auditActor?.name ??
                    auditActor?.email ??
                    auditLog.adminId.slice(0, 10))
                  : "System",
                action: auditLog.action,
                ip: auditLog.ip,
                userAgent: auditLog.userAgent,
                origin,
                createdAt: auditLog.createdAt.toISOString(),
              }
            : null,
          timeline,
          webhooks: webhookEvents.map((w) => ({
            id: w.id,
            eventType: w.eventType,
            processingStatus: w.processingStatus,
            createdAt: w.createdAt.toISOString(),
          })),
        },
      }
    }
  )
