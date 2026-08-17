import { Elysia } from "elysia"
import { openapi } from "@elysia/openapi"
import { serverTiming } from "@elysia/server-timing"
import { z } from "zod"
import { createApiLoggingPlugin } from "@/lib/api-logging"
import { enrichOpenApiDocument } from "@/lib/openapi-documentation"

import { adminRoutes } from "@/modules/admin/api/admin.route"
import { emailTemplateRoutes } from "@/modules/email-templates/api/email-templates.route"
import { emailLogRoutes } from "@/modules/email-templates/api/email-logs.route"
import { authRoutes } from "@/modules/auth/api/auth.route"
import { authWhoamiRoute } from "@/modules/auth/api/auth-whoami.route"
import { billingRoutes } from "@/modules/billing/api"
import { docsConsoleRoutes } from "@/modules/docs/api/docs-console.route"
import { docsRoutes } from "@/modules/docs/api/docs.route"
import { knowledgeRoutes } from "@/modules/docs/api/knowledge.route"
import { deployRoutes } from "@/modules/deploy/api/deploy.route"
import { frameworkDetectionRoutes } from "@/modules/framework-detection/api/framework-detection.route"
import { githubRoutes } from "@/modules/github/api/github.route"
import { githubEventLogRoutes } from "@/modules/github/api/github-event-log.route"
import { jenkinsRoutes } from "@/modules/jenkins/api/jenkins.route"
import { invoicesRoutes } from "@/modules/invoices/api/invoices.route"
import {
  paymentRoutes,
  userPaymentRoutes,
  webhookRoutes,
} from "@/modules/payment/api"
import { supportTicketAttachmentRoutes } from "@/modules/support-tickets/api/support-ticket-attachments.route"
import { supportTicketRoutes } from "@/modules/support-tickets/api/support-tickets.route"
import { tenantsRoutes } from "@/modules/tenants/api/tenants.route"
import { usersRoutes } from "@/modules/users/api/users.route"
import { mobileVpnRoutes } from "@/modules/vpn/mobile/api"
import { vpnRoutes } from "@/modules/vpn/api"
import { adminVpnRoutes } from "@/modules/vpn/admin/api"
import {
  vpnPackageCatalogRoutes,
  vpnSubscriptionRoutes,
  adminVpnSubscriptionRoutes,
} from "@/modules/vpn/subscriptions/api"
import { wireguardRoutes } from "@/modules/wireguard/api/wireguard.route"
import { startStaleSessionCleanup } from "@/modules/vpn/sessions/stale-cleanup"
import { voucherRoutes } from "@/modules/vouchers/api"
import { healthRoutes } from "@/modules/health/api/health.route"
import { markStartupComplete } from "@/modules/health/health.service"
import { whatsappRoutes } from "@/modules/whatsapp/whatsapp.module"
import { metaWebhookRoutes } from "@/modules/whatsapp/meta-apps/api/meta-webhook.route"
import { credentialsRoutes } from "@/modules/credentials/api/credentials.route"
import { webhookDeadLetterRoutes } from "@/modules/whatsapp/webhooks/api/webhook-dead-letter.route"

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
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
export const toOpenApiJsonSchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, {
    io: "input",
    target: "openapi-3.0",
    unrepresentable: "any",
  })

export const app = new Elysia({ prefix: "/api" })
  .use(createApiLoggingPlugin())
  .use(serverTiming())
  .onAfterHandle({ as: "global" }, ({ request, response }) => {
    if (new URL(request.url).pathname !== "/api/docs/json") {
      return
    }

    if (!isPlainObject(response)) {
      return
    }

    return enrichOpenApiDocument(response)
  })
  .use(
    openapi({
      path: "/docs",
      specPath: "/docs/json",
      mapJsonSchema: {
        zod: toOpenApiJsonSchema,
      },
      documentation: {
        info: {
          title: "PFNApp API Documentation",
          version: "1.0.0",
        },
        tags: [
          {
            name: "VPN Mobile Auth",
            description: "Device authentication and session token exchange",
          },
          {
            name: "VPN Mobile Pairing",
            description: "QR-code pairing flow",
          },
          {
            name: "VPN Mobile Profiles",
            description: "VPN profile listing and config download",
          },
          {
            name: "VPN Mobile Devices",
            description: "Device management",
          },
          {
            name: "VPN Mobile Sessions",
            description: "Active session tracking and heartbeats",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
    })
  )
  .onError(({ code, error, set }) => {
    if (code === "VALIDATION") {
      set.status = 422

      return {
        ok: false as const,
        error: "VALIDATION_ERROR" as const,
        message: "Please fix the highlighted fields and try again.",
        fieldErrors: toFieldErrors(error),
      }
    }

    if (code === "NOT_FOUND") {
      return
    }

    // Extract sub-error code from Prisma or other typed errors.
    // PrismaClientKnownRequestError always has a .code (e.g. "P2022").
    const detailCode =
      error &&
      typeof error === "object" &&
      typeof (error as Record<string, unknown>).code === "string"
        ? ((error as Record<string, unknown>).code as string)
        : null

    set.status = 500

    return {
      ok: false as const,
      error: "INTERNAL_SERVER_ERROR" as const,
      // Always expose the error category so operators can triage without
      // inspecting the server log. Safe: error codes are not secrets.
      ...(detailCode ? { errorType: detailCode } : {}),
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred."
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
    }
  })
  .use(credentialsRoutes)
  .use(webhookRoutes)
  .use(docsRoutes)
  .use(docsConsoleRoutes)
  .use(knowledgeRoutes)
  .use(deployRoutes)
  .use(frameworkDetectionRoutes)
  .use(githubRoutes)
  .use(githubEventLogRoutes)
  .use(jenkinsRoutes)
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
  .use(emailTemplateRoutes)
  .use(emailLogRoutes)
  .use(usersRoutes)
  .use(vpnRoutes)
  .use(mobileVpnRoutes)
  .use(adminVpnRoutes)
  .use(vpnPackageCatalogRoutes)
  .use(vpnSubscriptionRoutes)
  .use(adminVpnSubscriptionRoutes)
  .use(voucherRoutes)
  .use(healthRoutes)
  .use(metaWebhookRoutes)
  .use(webhookDeadLetterRoutes)
  .use(whatsappRoutes)
  .use(wireguardRoutes)
  .get("/health", ({ request }) => {
    const url = new URL(request.url)
    const base = url.origin

    return {
      endpoints: [
        { name: "self", href: `${base}/api/health` },
        { name: "healthz", href: `${base}/api/healthz` },
        { name: "liveness", href: `${base}/api/healthz/live` },
        { name: "readiness", href: `${base}/api/healthz/ready` },
        { name: "liveness (compat)", href: `${base}/api/health/liveness` },
        { name: "readiness (compat)", href: `${base}/api/health/readiness` },
        { name: "startup", href: `${base}/api/health/startup` },
        { name: "webhooks", href: `${base}/api/health/webhooks` },
      ],
    }
  })
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

// Start stale VPN session cleanup timer.
startStaleSessionCleanup()

// Mark startup complete immediately — app is ready to serve requests.
markStartupComplete()

export type App = typeof app
