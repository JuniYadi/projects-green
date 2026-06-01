import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import {
  whatsappAuthPlugin,
  guardOrgRead,
  guardOrgWrite,
  guardOrgFull,
} from "@/lib/whatsapp/auth"
import { enqueueWhatsAppTemplateSync } from "@/lib/queue/whatsapp-template-sync"

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

const templateUpdateSchema = t.Partial(t.Omit(templateBodySchema, ["languages"]))

export const templatesRoutes = new Elysia({ prefix: "/templates" })
  .use(whatsappAuthPlugin)
  .get("/", guardOrgRead(async ({ whatsappAuth }: { whatsappAuth: any }) => {
    const templates = await prisma.whatsappTemplate.findMany({
      where: whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin"
        ? { organizationId: whatsappAuth.organizationId! }
        : {},
      include: {
        languages: true,
      },
      orderBy: { createdAt: "desc" },
    })
    return { ok: true, templates }
  }))
  .get("/:id", guardOrgRead(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
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

    if (whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" && template.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    return { ok: true, template }
  }))
  .post("/", guardOrgWrite(async ({ body, whatsappAuth, set }: { body: any, whatsappAuth: any, set: any }) => {
    if (whatsappAuth.type === "workos" && !whatsappAuth.organizationId) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Organization ID required." }
    }

    const { languages, ...templateData } = body

    const template = await prisma.whatsappTemplate.create({
      data: {
        ...templateData,
        organizationId: whatsappAuth.type === "workos" ? whatsappAuth.organizationId! : (body as any).organizationId,
        languages: {
          create: languages,
        },
      },
      include: {
        languages: true,
      },
    })

    return { ok: true, template }
  }), {
    body: templateBodySchema
  })
  .patch("/:id", guardOrgWrite(async ({ params: { id }, body, whatsappAuth, set }: { params: { id: string }, body: any, whatsappAuth: any, set: any }) => {
    const template = await prisma.whatsappTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Template not found." }
    }

    if (whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" && template.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    const updated = await prisma.whatsappTemplate.update({
      where: { id },
      data: body,
      include: {
        languages: true,
      },
    })

    return { ok: true, template: updated }
  }), {
    body: templateUpdateSchema
  })
  .delete("/:id", guardOrgFull(async ({ params: { id } }: { params: { id: string } }) => {
    await prisma.whatsappTemplate.delete({
      where: { id },
    })
    return { ok: true, message: "Template deleted." }
  }))
  .post("/:id/sync", guardOrgWrite(async ({ params: { id }, whatsappAuth, set }: { params: { id: string }, whatsappAuth: any, set: any }) => {
    const template = await prisma.whatsappTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      set.status = 404
      return { ok: false, error: "NOT_FOUND", message: "Template not found." }
    }

    if (whatsappAuth.type === "workos" && whatsappAuth.platformRole !== "super_admin" && template.organizationId !== whatsappAuth.organizationId) {
      set.status = 403
      return { ok: false, error: "FORBIDDEN", message: "Access denied." }
    }

    if (!template.whatsappDeviceId) {
      set.status = 400
      return { ok: false, error: "BAD_REQUEST", message: "Device ID required for sync." }
    }

    await enqueueWhatsAppTemplateSync(template.organizationId, template.whatsappDeviceId, "sync-templates")

    return { ok: true, message: "Sync job enqueued." }
  }))
