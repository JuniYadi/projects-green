import { openapi } from "@elysia/openapi"
import { Elysia } from "elysia"
import { z } from "zod"

import { adminRoutes } from "@/modules/admin/api/admin.route"
import { authRoutes } from "@/modules/auth/api/auth.route"
import { authWhoamiRoute } from "@/modules/auth/api/auth-whoami.route"
import { billingRoutes } from "@/modules/billing/api"
import { docsConsoleRoutes } from "@/modules/docs/api/docs-console.route"
import { docsRoutes } from "@/modules/docs/api/docs.route"
import { knowledgeRoutes } from "@/modules/docs/api/knowledge.route"
import { deployRoutes } from "@/modules/deploy/api/deploy.route"
import { frameworkDetectionRoutes } from "@/modules/framework-detection/api/framework-detection.route"
import { githubRoutes } from "@/modules/github/api/github.route"
import { invoicesRoutes } from "@/modules/invoices/api/invoices.route"
import { paymentRoutes, userPaymentRoutes, webhookRoutes } from "@/modules/payment/api"
import { supportTicketAttachmentRoutes } from "@/modules/support-tickets/api/support-ticket-attachments.route"
import { supportTicketRoutes } from "@/modules/support-tickets/api/support-tickets.route"
import { tenantsRoutes } from "@/modules/tenants/api/tenants.route"
import { usersRoutes } from "@/modules/users/api/users.route"
import { whatsappRoutes } from "@/modules/whatsapp/whatsapp.module"

const parseErrorPath = (
  value: string | Array<string | number> | undefined
): string | null => {
  if (!value) {
    return null
  }

  if (Array.isArray(value)) {
    return value.join(".")
  }

  return value
    .replace(/^\//, "")
    .replace(/\//g, ".")
    .replace(/^value\./, "")
}

const toFieldErrors = (
  error: unknown
): Record<string, string[]> | undefined => {
  const maybeError = error as {
    all?: Array<{
      path?: string | Array<string | number>
      property?: string
      message?: string
    }>
  }

  const issues = maybeError.all

  if (!issues?.length) {
    return undefined
  }

  const fieldErrors: Record<string, string[]> = {}

  for (const issue of issues) {
    const key =
      parseErrorPath(issue.path) ?? parseErrorPath(issue.property) ?? null

    if (!key || !issue.message) {
      continue
    }

    if (!fieldErrors[key]) {
      fieldErrors[key] = []
    }

    fieldErrors[key].push(issue.message)
  }

  return Object.keys(fieldErrors).length ? fieldErrors : undefined
}

export const app = new Elysia({ prefix: "/api" })
  .use(openapi())
  .use(webhookRoutes)
  .use(docsRoutes)
  .use(docsConsoleRoutes)
  .use(knowledgeRoutes)
  .use(deployRoutes)
  .use(frameworkDetectionRoutes)
  .use(githubRoutes)
  .use(invoicesRoutes)
  .use(supportTicketRoutes)
  .use(supportTicketAttachmentRoutes)
  .use(tenantsRoutes)
  .use(authRoutes)
  .use(authWhoamiRoute)
  .use(billingRoutes)
  .use(paymentRoutes)
  .use(userPaymentRoutes)
  .use(adminRoutes)
  .use(usersRoutes)
  .use(whatsappRoutes)
  .onError(({ code, error, set }) => {
    if (code !== "VALIDATION") {
      return
    }

    set.status = 422

    return {
      ok: false as const,
      error: "VALIDATION_ERROR" as const,
      message: "Please fix the highlighted fields and try again.",
      fieldErrors: toFieldErrors(error),
    }
  })
  .get("/health", () => ({
    ok: true as const,
    timestamp: new Date().toISOString(),
  }))
  .post(
    "/echo",
    ({ body }) => ({
      ok: true as const,
      data: body,
      echoedAt: new Date().toISOString(),
    }),
    {
      body: z.object({
        message: z.string().min(1),
      }),
    }
  )

export type App = typeof app
