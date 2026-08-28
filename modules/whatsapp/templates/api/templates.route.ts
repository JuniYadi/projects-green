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
  whatsappDeviceId: t.String(),
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
      const where: Prisma.WhatsappTemplateWhereInput = {}
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
      } else if (query.wabaId || query.phoneId) {
        const device = await prisma.whatsappDevice.findFirst({
          where: {
            ...(where.organizationId
              ? { organizationId: where.organizationId as string }
              : {}),
            ...(query.wabaId
              ? { whatsappBusinessAccountId: String(query.wabaId) }
              : {}),
            ...(query.phoneId
              ? { whatsappPhoneId: String(query.phoneId) }
              : {}),
          },
          select: { id: true },
        })
        if (device) {
          where.whatsappDeviceId = device.id
        } else {
          // No matching device found for wabaId/phoneId, return empty result safely
          where.whatsappDeviceId = "non-existent-device-id"
        }
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

      if (query.broadcastEligible === "true") {
        where.syncStatus = "SYNCED"
        where.metaStatus = "APPROVED"
        where.languages = {
          some: {
            OR: [{ isApproved: true }, { metaStatus: "APPROVED" }],
          },
        }
      }

      const sortOrder = query.sort === "asc" ? "asc" : ("desc" as const)

      const [total, templates] = await Promise.all([
        prisma.whatsappTemplate.count({ where }),
        prisma.whatsappTemplate.findMany({
          where,
          include: {
            whatsappDevice: {
              select: {
                id: true,
                phoneNumber: true,
                status: true,
                whatsappBusinessAccountId: true,
                whatsappPhoneId: true,
              },
            },
            languages:
              query.broadcastEligible === "true"
                ? {
                    where: {
                      OR: [{ isApproved: true }, { metaStatus: "APPROVED" }],
                    },
                  }
                : true,
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
          whatsappDevice: {
            select: {
              id: true,
              phoneNumber: true,
              status: true,
              whatsappBusinessAccountId: true,
              whatsappPhoneId: true,
            },
          },
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

      const targetOrgId =
        whatsappAuth.organizationId ??
        (body as Record<string, string | undefined>).organizationId ??
        ""
      if (!targetOrgId) {
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
        whatsappDeviceId: string
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

      if (!whatsappDeviceId) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Active WhatsApp device is required.",
        }
      }

      // Guard: device must exist, belong to org, and be ACTIVE
      const device = await prisma.whatsappDevice.findFirst({
        where: {
          id: whatsappDeviceId,
          organizationId: targetOrgId,
          status: "ACTIVE",
        },
        select: {
          id: true,
          token: true,
          tokenEncrypted: true,
          tokenIv: true,
          whatsappPhoneId: true,
          whatsappBusinessAccountId: true,
        },
      })

      if (!device) {
        set.status = 400
        return {
          ok: false,
          error: "DEVICE_NOT_ACTIVE",
          message:
            "An active WhatsApp device owned by the organization is required.",
        }
      }

      // Guard: organization must have at least one ACTIVE WhatsApp subscription
      const subscription = await prisma.serviceSubscription.findFirst({
        where: {
          organizationId: targetOrgId,
          package: { code: "WHATSAPP" },
          status: "ACTIVE",
        },
        select: { id: true },
      })

      if (!subscription) {
        set.status = 403
        return {
          ok: false,
          error: "SUBSCRIPTION_REQUIRED",
          message:
            "An active WhatsApp subscription is required to create templates.",
        }
      }

      const languages = rawLanguages!.map((lang) => ({
        ...lang,
        parameters: lang.parameters as Prisma.InputJsonValue,
        buttons: lang.buttons as Prisma.InputJsonValue,
      }))

      const auth = whatsappAuth as AuthContext
      try {
        const template = await prisma.whatsappTemplate.create({
          data: {
            slug,
            name,
            description,
            category: category as WhatsappBillingCategory,
            whatsappDeviceId: device.id,
            organizationId: targetOrgId,
            syncStatus: "NOT_SYNCED",
            metaStatus: null,
            languages: {
              create: languages,
            },
          },
          include: {
            languages: true,
          },
        })

        // Direct push to Meta if device has credentials
        let finalTemplate = template
        try {
          const encryptedParts = device.tokenEncrypted?.split(".") ?? []
          const accessToken =
            device.tokenEncrypted &&
            device.tokenIv &&
            encryptedParts.length === 2
              ? `${encryptedParts[0]}.${device.tokenIv}.${encryptedParts[1]}`
              : (device.tokenEncrypted ?? device.token)
          const phoneNumberId = device.whatsappPhoneId
          const wabaId = device.whatsappBusinessAccountId

          if (accessToken && phoneNumberId && wabaId) {
            const metaClient = await WhatsAppDeviceClient.fromDevice({
              accessToken,
              phoneNumberId,
              wabaId,
              organizationId: targetOrgId,
            })

            let latestMetaStatus: WhatsappTemplateSyncStatus = "NOT_SYNCED"
            let metaStatusValue: any = null

            for (const lang of template.languages) {
              try {
                const components = buildMetaTemplateComponents({
                  ...lang,
                  category: template.category ?? undefined,
                })
                const payload = {
                  name: template.slug || template.name,
                  category: template.category || "UTILITY",
                  language: lang.lang,
                  components,
                }
                const metaResult = await metaClient.createTemplate(payload)
                const rawStatus = metaResult?.status?.toUpperCase()
                const supportedStatus =
                  rawStatus === "APPROVED" ||
                  rawStatus === "PENDING" ||
                  rawStatus === "REJECTED"
                    ? rawStatus
                    : "PENDING"

                metaStatusValue = supportedStatus
                latestMetaStatus = "SYNCED"

                await prisma.whatsappTemplateLanguage.update({
                  where: { id: lang.id },
                  data: {
                    metaStatus: supportedStatus,
                    isApproved: supportedStatus === "APPROVED",
                  },
                })
              } catch (langErr) {
                await logWhatsappAuditEvent({
                  action: "TEMPLATE_META_CREATE_FAILED",
                  organizationId: template.organizationId,
                  adminId: auth.userId,
                  deviceId: device.id,
                  message: `Failed to push language variant ${lang.lang} to Meta for template ${template.name}`,
                  errorMessage: String(langErr),
                  status: "FAILED",
                })
              }
            }

            if (latestMetaStatus === "SYNCED") {
              finalTemplate = (await prisma.whatsappTemplate.update({
                where: { id: template.id },
                data: {
                  syncStatus: "SYNCED",
                  metaStatus: metaStatusValue,
                  lastSyncedAt: new Date(),
                },
                include: {
                  languages: true,
                },
              })) as typeof template
            }
          }
        } catch (pushErr) {
          await logWhatsappAuditEvent({
            action: "TEMPLATE_META_CREATE_FAILED",
            organizationId: template.organizationId,
            adminId: auth.userId,
            deviceId: device.id,
            message: `Direct push to Meta failed for template ${template.name}`,
            errorMessage: String(pushErr),
            status: "FAILED",
          })
        }

        await logWhatsappAuditEvent({
          action: "TEMPLATE_CREATED",
          organizationId: template.organizationId,
          adminId: auth.userId,
          deviceId: device.id,
          message: `Template created: ${template.name} (${template.slug})`,
          status: "OK",
          details: {
            templateId: template.id,
            slug: template.slug,
          },
        })
        return { ok: true, template: toWhatsappTemplateDTO(finalTemplate) }
      } catch (err) {
        await logWhatsappAuditEvent({
          action: "TEMPLATE_CREATE_FAILED",
          organizationId: targetOrgId,
          adminId: auth.userId,
          message: "Template DB creation failed",
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
        const {
          languages: _langs,
          id: _id,
          organizationId: _orgId,
          syncStatus: _ss,
          metaStatus: _ms,
          lastSyncedAt: _ls,
          createdAt: _ca,
          updatedAt: _ua,
          ...safeFields
        } = bodyRecord

        const updateData = hasLanguages
          ? ({
              ...safeFields,
              languages: {
                upsert: (bodyRecord.languages as UpdateLanguage[]).map(
                  (lang) => ({
                    where: { id: lang.id ?? "" },
                    create: {
                      lang: lang.lang,
                      headerType: lang.headerType,
                      headerUrl: lang.headerUrl,
                      headerText: lang.headerText,
                      body: lang.body,
                      parameters: lang.parameters as Prisma.InputJsonValue,
                      footer: lang.footer,
                      buttons: lang.buttons as Prisma.InputJsonValue,
                    },
                    update: {
                      headerType: lang.headerType,
                      headerUrl: lang.headerUrl,
                      headerText: lang.headerText,
                      body: lang.body,
                      parameters: lang.parameters as Prisma.InputJsonValue,
                      footer: lang.footer,
                      buttons: lang.buttons as Prisma.InputJsonValue,
                    },
                  })
                ),
              },
            } as Prisma.WhatsappTemplateUpdateInput)
          : (safeFields as Prisma.WhatsappTemplateUpdateInput)

        const updated = await prisma.whatsappTemplate.update({
          where: { id: params.id },
          data: updateData,
          include: {
            languages: true,
          },
        })

        await logWhatsappAuditEvent({
          action: "TEMPLATE_UPDATED",
          organizationId: updated.organizationId,
          adminId: auth.userId,
          message: `Template updated: ${updated.name}`,
          status: "OK",
        })

        return { ok: true, template: toWhatsappTemplateDTO(updated) }
      } catch (err: unknown) {
        await logWhatsappAuditEvent({
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

      await logWhatsappAuditEvent({
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

      await logWhatsappAuditEvent({
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
        await logWhatsappAuditEvent({
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
