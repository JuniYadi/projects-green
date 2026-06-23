import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
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
  languages: t.Array(templateLanguageSchema),
})

const templateUpdateSchema = t.Partial(
  t.Omit(templateBodySchema, ["languages"])
)
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
      const whatsappAuth = await resolveAuthContext(request)
      if (!whatsappAuth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      const { page, limit, skip } = getPagination(query)
      const where: Record<string, unknown> = {}

      // Non-super_admin: auto-scope to own org (existing behavior)
      if (
        whatsappAuth.type === "workos" &&
        whatsappAuth.platformRole !== "super_admin"
      ) {
        where.organizationId = whatsappAuth.organizationId!
      } else if (query.organizationId) {
        // Super_admin explicit org filter
        where.organizationId = String(query.organizationId)
      }

      // Device filter (any role)
      if (query.whatsappDeviceId) {
        where.whatsappDeviceId = String(query.whatsappDeviceId)
      }

      const [total, templates] = await Promise.all([
        prisma.whatsappTemplate.count({ where }),
        prisma.whatsappTemplate.findMany({
          where,
          include: {
            languages: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ])
      const data = templates.map(toWhatsappTemplateDTO)
      return {
        ok: true,
        templates: data,
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
      const template = await prisma.whatsappTemplate.findUnique({
        where: { id },
        include: {
          languages: true,
        },
      })

      if (!template) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Template not found." }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        template.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      return { ok: true, template: toWhatsappTemplateDTO(template) }
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
      if (whatsappAuth.type === "workos" && !whatsappAuth.organizationId) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Organization ID required.",
        }
      }

      const { languages, ...templateData } = body

      try {
        const template = await prisma.whatsappTemplate.create({
          data: {
            ...templateData,
            organizationId:
              whatsappAuth.type === "workos"
                ? whatsappAuth.organizationId!
                : (body as any).organizationId,
            languages: {
              create: languages,
            },
          },
          include: {
            languages: true,
          },
        })

        logWhatsappAuditEvent({
          action: "TEMPLATE_CREATED",
          organizationId: template.organizationId,
          adminId: (whatsappAuth as any).userId,
          message: `Template created: ${template.name}`,
          status: "OK",
          details: { templateId: template.id, slug: template.slug },
        })

        return { ok: true, template: toWhatsappTemplateDTO(template) }
      } catch (err) {
        logWhatsappAuditEvent({
          action: "TEMPLATE_CREATE_FAILED",
          organizationId: whatsappAuth.organizationId ?? "",
          adminId: (whatsappAuth as any).userId,
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
      const template = await prisma.whatsappTemplate.findUnique({
        where: { id },
      })

      if (!template) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Template not found." }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        template.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      try {
        const updated = await prisma.whatsappTemplate.update({
          where: { id },
          data: body,
          include: {
            languages: true,
          },
        })

        logWhatsappAuditEvent({
          action: "TEMPLATE_UPDATED",
          organizationId: updated.organizationId,
          adminId: (whatsappAuth as any).userId,
          message: `Template updated: ${updated.name}`,
          status: "OK",
        })

        return { ok: true, template: toWhatsappTemplateDTO(updated) }
      } catch (err) {
        logWhatsappAuditEvent({
          action: "TEMPLATE_UPDATE_FAILED",
          organizationId: template.organizationId,
          adminId: (whatsappAuth as any).userId,
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
      const template = await prisma.whatsappTemplate.findUnique({
        where: { id },
      })

      if (!template) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Template not found." }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        template.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      await prisma.whatsappTemplate.delete({
        where: { id },
      })

      logWhatsappAuditEvent({
        action: "TEMPLATE_DELETED",
        organizationId: template.organizationId,
        adminId: (whatsappAuth as any).userId,
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
      const template = await prisma.whatsappTemplate.findUnique({
        where: { id },
      })

      if (!template) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Template not found." }
      }

      if (
        (whatsappAuth as any).platformRole !== "super_admin" &&
        template.organizationId !== whatsappAuth.organizationId
      ) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      if (!template.whatsappDeviceId) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Device ID required for sync.",
        }
      }

      await enqueueWhatsAppTemplateSync(
        template.organizationId,
        template.whatsappDeviceId,
        "sync-templates"
      )

      return { ok: true, message: "Sync job enqueued." }
    }
  )
