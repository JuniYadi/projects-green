import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import type {
  Prisma,
  WhatsappBillingCategory,
  WhatsappTemplateSyncStatus,
} from "@prisma/client"
import {
  resolveAuthContext,
  type ResolvedAuth,
} from "@/lib/auth/resolve-proxy-auth"
import { enqueueWhatsAppTemplateSync } from "@/lib/queue/whatsapp-template-sync"
import { toWhatsappTemplateDTO } from "../templates.dto"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import { buildMetaTemplateComponents } from "../template-validator"

const isSuperAdmin = (auth: ResolvedAuth) =>
  auth.type === "workos" && auth.platformRole === "super_admin"

const templateLanguageSchema = t.Object({
  lang: t.String(),
  headerType: t.Optional(t.String()),
  headerUrl: t.Optional(t.String()),
  headerText: t.Optional(t.String()),
  body: t.Optional(t.String()),
  parameters: t.Optional(t.Any()),
  footer: t.Optional(t.String()),
  buttons: t.Optional(t.Any()),
  authConfig: t.Optional(t.Any()),
})

const templateBodySchema = t.Object({
  slug: t.String(),
  name: t.String(),
  description: t.Optional(t.String()),
  whatsappDeviceId: t.Optional(t.String()),
  category: t.Optional(
    t.Union([
      t.Literal("MARKETING"),
      t.Literal("UTILITY"),
      t.Literal("AUTHENTICATION"),
    ])
  ),
  languages: t.Array(templateLanguageSchema),
})

const templateUpdateLanguageSchema = t.Object({
  lang: t.String(),
  headerType: t.Optional(t.String()),
  headerUrl: t.Optional(t.String()),
  headerText: t.Optional(t.String()),
  body: t.Optional(t.String()),
  parameters: t.Optional(t.Any()),
  footer: t.Optional(t.String()),
  buttons: t.Optional(t.Any()),
  id: t.Optional(t.String()),
})

const templateUpdateSchema = t.Partial(
  t.Object({
    slug: t.String(),
    name: t.String(),
    description: t.Optional(t.String()),
    whatsappDeviceId: t.Optional(t.String()),
    category: t.Optional(
      t.Union([
        t.Literal("MARKETING"),
        t.Literal("UTILITY"),
        t.Literal("AUTHENTICATION"),
      ])
    ),
    languages: t.Optional(t.Array(templateUpdateLanguageSchema)),
  })
)

type AuthContext = {
  platformRole: string
  organizationId: string
  userId: string
}

type BodyRecord = Record<string, unknown>

type UpdateLanguage = {
  id?: string
  lang: string
  headerType?: string
  headerText?: string
  headerUrl?: string
  body?: string
  parameters?: unknown
  footer?: string
  buttons?: unknown
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function getPagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page) || 1, 1)
  const limit = Math.min(
    Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  )
  return { page, limit, skip: (page - 1) * limit }
}

export const templatesRoutes = new Elysia({ prefix: "/templates" })
  .get(
    "/",
    async ({ request, set, query }: { request: any; set: any; query: any }) => {
      const whatsappAuth = await resolveAuthContext(request as Request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const { page, limit, skip } = getPagination(query)
      const where: BodyRecord = {}

      if (!isSuperAdmin(whatsappAuth)) {
        if (!whatsappAuth.organizationId) {
          set.status = 403
          return {
            ok: false,
            error: "FORBIDDEN",
            message: "Organization ID required.",
          }
        }
        where.organizationId = whatsappAuth.organizationId
      } else if (query.organizationId) {
        where.organizationId = String(query.organizationId)
      }

      if (query.whatsappDeviceId) {
        where.whatsappDeviceId = String(query.whatsappDeviceId)
      }

      const VALID_SYNC_STATUSES = [
        "SYNCED",
        "NOT_SYNCED",
        "NOT_IN_META",
      ] as const
      if (
        query.syncStatus &&
        VALID_SYNC_STATUSES.includes(
          query.syncStatus as (typeof VALID_SYNC_STATUSES)[number]
        )
      ) {
        where.syncStatus = query.syncStatus as WhatsappTemplateSyncStatus
      }

      const sortOrder = query.sort === "asc" ? "asc" : ("desc" as const)

      const [total, templates] = await Promise.all([
        prisma.whatsappTemplate.count({ where }),
        prisma.whatsappTemplate.findMany({
          where,
          include: {
            languages: true,
          },
          orderBy: { createdAt: sortOrder },
          skip,
          take: limit,
        }),
      ])
      const data = templates.map(toWhatsappTemplateDTO)
      return {
        ok: true,
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      }
    }
  )
  .get(
    "/:id",
    async ({
      request,
      params,
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request as Request)
      if (!whatsappAuth) {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Auth required.",
        }
      }
      const template = await prisma.whatsappTemplate.findUnique({
        where: { id: params.id },
        include: {
          languages: true,
        },
      })

      if (!template) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Template not found.",
        }
      }

      const auth = whatsappAuth as AuthContext
      if (
        auth.platformRole !== "super_admin" &&
        template.organizationId !== auth.organizationId
      ) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Access denied.",
        }
      }

      return { ok: true, template: toWhatsappTemplateDTO(template) }
    }
  )
  .post(
    "/",
    async ({ request, body, set }: { request: any; body: any; set: any }) => {
      const whatsappAuth = await resolveAuthContext(request as Request)
      if (!whatsappAuth) {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Auth required.",
        }
      }
      if (whatsappAuth.type === "workos" && !whatsappAuth.organizationId) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Organization ID required.",
        }
      }

      const bodyObj = body as BodyRecord & {
        languages: Array<{
          lang: string
          headerType?: string
          headerUrl?: string
          headerText?: string
          body?: string
          parameters?: unknown
          footer?: string
          buttons?: unknown
        }>
        slug: string
        name: string
        description?: string
        category?: string
        whatsappDeviceId?: string
        organizationId?: string
      }
      const {
        languages: rawLanguages,
        slug,
        name,
        description,
        category,
        whatsappDeviceId,
      } = bodyObj
      const languages = rawLanguages!.map((lang) => ({
        ...lang,
        parameters: lang.parameters as Prisma.InputJsonValue,
        buttons: lang.buttons as Prisma.InputJsonValue,
      }))

      const targetOrgId =
        whatsappAuth.type === "workos"
          ? whatsappAuth.organizationId!
          : bodyObj.organizationId!

      // Resolve WhatsApp Device to push to Meta
      let device = null
      if (whatsappDeviceId) {
        device = await prisma.whatsappDevice.findFirst({
          where: {
            id: whatsappDeviceId,
            organizationId: targetOrgId,
            status: "ACTIVE",
          },
        })
      } else {
        device = await prisma.whatsappDevice.findFirst({
          where: {
            organizationId: targetOrgId,
            status: "ACTIVE",
          },
          orderBy: { createdAt: "desc" },
        })
      }

      if (
        !device ||
        !device.tokenEncrypted ||
        !device.whatsappBusinessAccountId
      ) {
        set.status = 400
        return {
          ok: false,
          error: "NO_ACTIVE_DEVICE",
          message:
            "An active WhatsApp device with business account credentials is required to create templates in Meta.",
        }
      }

      const auth = whatsappAuth as AuthContext
      let metaTemplateId: string | undefined
      let metaStatus: WhatsappTemplateSyncStatus = "NOT_SYNCED"

      // Direct push to Meta Cloud API (no queue)
      try {
        const client = await WhatsAppDeviceClient.fromDevice({
          accessToken: device.tokenEncrypted,
          phoneNumberId: device.whatsappPhoneId ?? "",
          wabaId: device.whatsappBusinessAccountId,
          metaAppId: device.whatsappMetaAppId ?? undefined,
          organizationId: targetOrgId,
        })

        const isAuthCat = (category ?? "").toUpperCase() === "AUTHENTICATION"
        for (const lang of rawLanguages!) {
          const authCfg = (lang as Record<string, unknown>).authConfig as
            | Record<string, unknown>
            | undefined
          const ttlMinutes =
            typeof authCfg?.messageValidityMinutes === "number"
              ? authCfg.messageValidityMinutes
              : typeof authCfg?.messageSendTtlMinutes === "number"
                ? authCfg.messageSendTtlMinutes
                : undefined
          const messageSendTtlSeconds =
            typeof ttlMinutes === "number"
              ? Math.max(60, Math.min(900, ttlMinutes * 60))
              : undefined

          const components = buildMetaTemplateComponents({
            ...lang,
            category,
            addSecurityRecommendation: authCfg?.addSecurityRecommendation as
              | boolean
              | undefined,
            codeExpirationMinutes: authCfg?.codeExpirationMinutes as
              | number
              | undefined,
          })
          const metaResult = await client.createTemplate({
            name: slug,
            category: (category ?? "UTILITY").toUpperCase(),
            language: lang.lang,
            components,
            ...(isAuthCat && messageSendTtlSeconds
              ? { message_send_ttl_seconds: messageSendTtlSeconds }
              : {}),
          })
          if (metaResult?.id) {
            metaTemplateId = metaResult.id
          }
        }
        metaStatus = "SYNCED"
      } catch (metaErr: unknown) {
        const metaErrRecord =
          metaErr && typeof metaErr === "object"
            ? (metaErr as Record<string, unknown>)
            : null
        const innerError =
          metaErrRecord?.error && typeof metaErrRecord.error === "object"
            ? (metaErrRecord.error as Record<string, unknown>)
            : null
        const metaErrorMessage =
          (typeof innerError?.message === "string" && innerError.message) ||
          (typeof metaErrRecord?.message === "string" &&
            metaErrRecord.message) ||
          String(metaErr)

        logWhatsappAuditEvent({
          action: "TEMPLATE_META_CREATE_FAILED",
          organizationId: targetOrgId,
          adminId: auth.userId,
          deviceId: device.id,
          message: `Failed to push template to Meta: ${name} (${slug})`,
          errorMessage: metaErrorMessage,
          status: "FAILED",
          details: { slug, name, category },
        })
        set.status = 502
        return {
          ok: false,
          error: "META_API_ERROR",
          message: metaErrorMessage,
        }
      }
      try {
        const template = await prisma.whatsappTemplate.create({
          data: {
            slug,
            name,
            description,
            category: category as WhatsappBillingCategory,
            whatsappDeviceId: device.id,
            organizationId: targetOrgId,
            syncStatus: "SYNCED",
            metaStatus: "PENDING",
            lastSyncedAt: new Date(),
            languages: {
              create: languages.map((l) => ({
                ...l,
                metaStatus: "PENDING",
                isApproved: false,
              })),
            },
          },
          include: {
            languages: true,
          },
        })

        logWhatsappAuditEvent({
          action: "TEMPLATE_META_CREATED",
          organizationId: template.organizationId,
          adminId: auth.userId,
          deviceId: device.id,
          message: `Template created and pushed to Meta: ${template.name} (${template.slug})`,
          status: "OK",
          details: {
            templateId: template.id,
            slug: template.slug,
            metaTemplateId,
            wabaId: device.whatsappBusinessAccountId,
          },
        })

        return { ok: true, template: toWhatsappTemplateDTO(template) }
      } catch (err) {
        logWhatsappAuditEvent({
          action: "TEMPLATE_CREATE_FAILED",
          organizationId: targetOrgId,
          adminId: auth.userId,
          message: "Template DB creation failed after Meta push",
          errorMessage: String(err),
          status: "FAILED",
        })
        throw err
      }
    },
    {
      body: templateBodySchema,
    }
  )
  .patch(
    "/:id",
    async ({
      request,
      params,
      body,
      set,
    }: {
      request: any
      params: { id: string }
      body: any
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request as Request)
      if (!whatsappAuth) {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Auth required.",
        }
      }
      const template = await prisma.whatsappTemplate.findUnique({
        where: { id: params.id },
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

      const auth = whatsappAuth as AuthContext
      if (
        auth.platformRole !== "super_admin" &&
        template.organizationId !== auth.organizationId
      ) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Access denied.",
        }
      }
      const bodyRecord = body as BodyRecord

      // Only lock templates that were successfully synced and approved by Meta
      if (
        template.syncStatus === "SYNCED" &&
        template.metaStatus === "APPROVED"
      ) {
        set.status = 422
        return {
          ok: false,
          error: "TEMPLATE_IMMUTABLE",
          message:
            "Templates submitted to Meta cannot be modified. Create a new template instead.",
        }
      }
      // ── Unapproved template update ─────────────────────────────────────
      try {
        const hasLanguages =
          Array.isArray(bodyRecord.languages) && bodyRecord.languages.length > 0
        const updateData = hasLanguages
          ? {
              ...bodyRecord,
              languages: {
                deleteMany: {},
                create: (bodyRecord.languages as UpdateLanguage[]).map(
                  (lang) => ({
                    lang: lang.lang,
                    headerType: lang.headerType,
                    headerUrl: lang.headerUrl,
                    headerText: lang.headerText,
                    body: lang.body,
                    parameters: lang.parameters,
                    footer: lang.footer,
                    buttons: lang.buttons,
                  })
                ),
              },
            }
          : bodyRecord

        const updated = await prisma.whatsappTemplate.update({
          where: { id: params.id },
          data: updateData,
          include: {
            languages: true,
          },
        })

        logWhatsappAuditEvent({
          action: "TEMPLATE_UPDATED",
          organizationId: updated.organizationId,
          adminId: auth.userId,
          message: `Template updated: ${updated.name}`,
          status: "OK",
        })

        return { ok: true, template: toWhatsappTemplateDTO(updated) }
      } catch (err: unknown) {
        logWhatsappAuditEvent({
          action: "TEMPLATE_UPDATE_FAILED",
          organizationId: template.organizationId,
          adminId: auth.userId,
          message: "Template update failed",
          errorMessage: String(err),
          status: "FAILED",
        })
        set.status = 500
        return {
          ok: false,
          error: "INTERNAL_ERROR",
          message: String(err),
        }
      }
    },
    {
      body: templateUpdateSchema,
    }
  )
  .delete(
    "/:id",
    async ({
      request,
      params,
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request as Request)
      if (!whatsappAuth) {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Auth required.",
        }
      }
      const template = await prisma.whatsappTemplate.findUnique({
        where: { id: params.id },
      })

      if (!template) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Template not found.",
        }
      }

      const auth = whatsappAuth as AuthContext
      if (
        auth.platformRole !== "super_admin" &&
        template.organizationId !== auth.organizationId
      ) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Access denied.",
        }
      }

      await prisma.whatsappTemplate.delete({
        where: { id: params.id },
      })

      logWhatsappAuditEvent({
        action: "TEMPLATE_DELETED",
        organizationId: template.organizationId,
        adminId: auth.userId,
        message: `Template deleted: ${template.name}`,
        status: "OK",
      })

      return { ok: true, message: "Template deleted." }
    }
  )
  .post(
    "/:id/sync",
    async ({
      request,
      params,
      set,
    }: {
      request: any
      params: { id: string }
      set: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request as Request)
      if (!whatsappAuth) {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Auth required.",
        }
      }
      const template = await prisma.whatsappTemplate.findUnique({
        where: { id: params.id },
      })

      if (!template) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "Template not found.",
        }
      }

      const auth = whatsappAuth as AuthContext
      if (
        auth.platformRole !== "super_admin" &&
        template.organizationId !== auth.organizationId
      ) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Access denied.",
        }
      }

      if (!template.whatsappDeviceId) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Device ID required for sync.",
        }
      }

      logWhatsappAuditEvent({
        action: "TEMPLATE_SYNC_REQUESTED",
        organizationId: template.organizationId,
        adminId: auth.userId,
        message: `Template sync requested: ${template.name}`,
        status: "STARTED",
      })

      try {
        await enqueueWhatsAppTemplateSync(
          template.organizationId,
          template.whatsappDeviceId,
          "sync-templates"
        )

        return { ok: true, message: "Sync job enqueued." }
      } catch (err) {
        logWhatsappAuditEvent({
          action: "TEMPLATE_SYNC_FAILED",
          organizationId: template.organizationId,
          adminId: auth.userId,
          message: "Template sync failed at route level",
          errorMessage: String(err),
          status: "FAILED",
        })
        set.status = 500
        return {
          ok: false,
          error: "INTERNAL",
          message: "Failed to enqueue sync job.",
        }
      }
    }
  )
