import { Elysia } from "elysia"
import { z } from "zod"

import { adminAuthGuard } from "@/modules/admin/api/admin.guards"
import { EMAIL_TEMPLATES, renderEmailTemplate } from "@/lib/email-templates"

const paramsSchema = z.object({ id: z.string().trim().min(1) })

export const emailTemplateRoutes = new Elysia()
  .use(adminAuthGuard)
  .get("/email-templates", () => ({ ok: true, data: EMAIL_TEMPLATES }))
  .get(
    "/email-templates/:id/preview",
    async ({ params, set }) => {
      const { id } = paramsSchema.parse(params)
      const tpl = EMAIL_TEMPLATES.find((t) => t.id === id)

      if (!tpl) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Template not found" }
      }

      const html = await renderEmailTemplate(id)
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    },
    { params: paramsSchema }
  )
