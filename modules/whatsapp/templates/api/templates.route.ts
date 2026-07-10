import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import type { Prisma, WhatsappBillingCategory, WhatsappTemplateSyncStatus } from "@prisma/client"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { requireSuperAdmin } from "@/lib/whatsapp/auth"
import { enqueueWhatsAppTemplateSync } from "@/lib/queue/whatsapp-template-sync"
import { toWhatsappTemplateDTO } from "../templates.dto"
import { logWhatsappAuditEvent } from "@/modules/whatsapp/audit/whatsapp-audit.service"

const templateLanguageSchema = t.Object({
  lang: t.String(),
  headerType: t.Optional(t.String()),
  headerUrl: t.Optional(t.String()),
  headerText: t.Optional(t.String()),
  body: t.Optional(t.String()),
  parameters: t.Optional(t.Any()),
  footer: t.Optional(t.String()),
  buttons: t.Optional(t.Any()),
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
    async ({
      request,
      set,
      query,
    }: {
      request: any
      set: any
      query: any
    }) => {
      const whatsappAuth = await resolveAuthContext(request as Request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const { page, limit, skip } = getPagination(query)
      const where: BodyRecord = {}

      if (!requireSuperAdmin(whatsappAuth)) {
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
    async ({
      request,
      body,
      set,
    }: {
      request: any
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
      if (
        whatsappAuth.type === "workos" &&
        !whatsappAuth.organizationId
      ) {
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
      const { languages: rawLanguages, slug, name, description, category, whatsappDeviceId } = bodyObj
      const languages = rawLanguages!.map((lang) => ({
        ...lang,
        parameters: lang.parameters as Prisma.InputJsonValue,
        buttons: lang.buttons as Prisma.InputJsonValue,
      }))

      try {
        const template = await prisma.whatsappTemplate.create({
          data: {
            slug,
            name,
            description,
            category: category as WhatsappBillingCategory,
            whatsappDeviceId,
            organizationId:
              whatsappAuth.type === "workos"
                ? whatsappAuth.organizationId!
                : bodyObj.organizationId!,
            languages: {
              create: languages,
            },
          },
          include: {
            languages: true,
          },
        })

        const auth = whatsappAuth as AuthContext
        logWhatsappAuditEvent({
          action: "TEMPLATE_CREATED",
          organizationId: template.organizationId,
          adminId: auth.userId,
          message: `Template created: ${template.name}`,
          status: "OK",
          details: { templateId: template.id, slug: template.slug },
        })

        return { ok: true, template: toWhatsappTemplateDTO(template) }
      } catch (err) {
        const auth = whatsappAuth as AuthContext
        logWhatsappAuditEvent({
          action: "TEMPLATE_CREATE_FAILED",
          organizationId: whatsappAuth.organizationId ?? "",
          adminId: auth.userId,
          message: "Template creation failed",
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

      // ── Approved template restrictions ─────────────────────────────────
      if (template.metaStatus === "APPROVED") {
        const coreFields: Record<string, true> = {
          name: true,
          slug: true,
          description: true,
          category: true,
          whatsappDeviceId: true,
        }
        const hasCoreField = Object.keys(coreFields).some(
          (f) => f in bodyRecord
        )
        if (hasCoreField) {
          set.status = 422
          return {
            ok: false,
            error: "VALIDATION_ERROR",
            message:
              "Approved templates can only add language variants.",
          }
        }

        const languages = bodyRecord.languages as
          | UpdateLanguage[]
          | undefined

        if (languages && languages.length > 0) {
          const existingLangs = new Set(
            template.languages.map((l) => l.lang)
          )
          const existingIds = new Set(
            template.languages.map((l) => l.id)
          )

          for (const lang of languages) {
            if (lang.id && existingIds.has(lang.id)) {
              set.status = 422
              return {
                ok: false,
                error: "VALIDATION_ERROR",
                message:
                  "Approved template language variants cannot be edited.",
              }
            }
            if (existingLangs.has(lang.lang)) {
              set.status = 422
              return {
                ok: false,
                error: "VALIDATION_ERROR",
                message:
                  "Approved template language variants cannot be edited.",
              }
            }
          }

          const structureSource =
            template.languages.find(
              (l) => l.isApproved || l.metaStatus === "APPROVED"
            ) ?? template.languages[0] ?? null

          if (!structureSource) {
            set.status = 422
            return {
              ok: false,
              error: "VALIDATION_ERROR",
              message:
                "No approved language variant found to validate structure against.",
            }
          }

          for (const lang of languages) {
            const mismatch =
              (lang.headerType ?? "NONE") !==
                (structureSource.headerType ?? "NONE") ||
              (lang.headerText ?? "") !==
                (structureSource.headerText ?? "") ||
              (lang.headerUrl ?? "") !==
                (structureSource.headerUrl ?? "") ||
              (lang.body ?? "") !== (structureSource.body ?? "") ||
              (lang.footer ?? "") !== (structureSource.footer ?? "") ||
              JSON.stringify(lang.parameters ?? null) !==
                JSON.stringify(structureSource.parameters ?? null) ||
              JSON.stringify(lang.buttons ?? null) !==
                JSON.stringify(structureSource.buttons ?? null)
            if (mismatch) {
              set.status = 422
              return {
                ok: false,
                error: "VALIDATION_ERROR",
                message:
                  "New language variants must match the approved template structure.",
              }
            }
          }

          const languagesWithoutIds = languages.map((lang) => ({
            lang: lang.lang,
            headerType: lang.headerType,
            headerUrl: lang.headerUrl,
            headerText: lang.headerText,
            body: lang.body,
            parameters: lang.parameters as Prisma.InputJsonValue,
            footer: lang.footer,
            buttons: lang.buttons as Prisma.InputJsonValue,
          }))

          try {
            const updated = await prisma.whatsappTemplate.update({
              where: { id: params.id },
              data: { languages: { create: languagesWithoutIds } },
              include: { languages: true },
            })

            logWhatsappAuditEvent({
              action: "TEMPLATE_UPDATED",
              organizationId: updated.organizationId,
              adminId: auth.userId,
              message: `Template updated: ${updated.name}`,
              status: "OK",
            })

            return { ok: true, template: toWhatsappTemplateDTO(updated) }
          } catch (err) {
            logWhatsappAuditEvent({
              action: "TEMPLATE_UPDATE_FAILED",
              organizationId: template.organizationId,
              adminId: auth.userId,
              message: "Template update failed",
              errorMessage: String(err),
              status: "FAILED",
            })
            throw err
          }
        }
      }

      // ── Unapproved template update ─────────────────────────────────────
      try {
        const hasLanguages =
          Array.isArray(bodyRecord.languages) &&
          bodyRecord.languages.length > 0
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
      } catch (err) {
        logWhatsappAuditEvent({
          action: "TEMPLATE_UPDATE_FAILED",
          organizationId: template.organizationId,
          adminId: auth.userId,
          message: "Template update failed",
          errorMessage: String(err),
          status: "FAILED",
        })
        throw err
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
