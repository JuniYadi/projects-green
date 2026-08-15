import { Hono } from "hono"
import type { MiddlewareHandler } from "hono"

import {
  normalizeWhatsappOrganizationApiKeyClientIp,
  verifyWhatsappOrganizationApiKey,
  type WhatsappOrganizationApiKeyAuthContext,
} from "../organization-api-keys/organization-api-key.verifier"

export type WhatsappSystemApiEnv = {
  Variables: {
    whatsappOrganizationApiKey: WhatsappOrganizationApiKeyAuthContext
  }
}

export type WhatsappOrganizationApiKeyVerifier = (
  rawKey: string | null,
  options?: {
    clientIp?: string | null
    userAgent?: string | null
  }
) => Promise<WhatsappOrganizationApiKeyAuthContext | null>

const unauthorized = (c: { json: (body: unknown, status: 401) => Response }) =>
  c.json(
    {
      ok: false,
      error: "UNAUTHORIZED",
      message: "Valid WhatsApp organization API key required.",
    },
    401
  )

const bearerToken = (authorization: string | undefined) => {
  if (!authorization?.startsWith("Bearer ")) return null
  const token = authorization.slice("Bearer ".length).trim()
  return token || null
}

export const createWhatsappOrganizationApiKeyMiddleware =
  (
    verifier: WhatsappOrganizationApiKeyVerifier = verifyWhatsappOrganizationApiKey
  ): MiddlewareHandler<WhatsappSystemApiEnv> =>
  async (c, next) => {
    const verified = await verifier(
      bearerToken(c.req.header("Authorization")),
      {
        clientIp: normalizeWhatsappOrganizationApiKeyClientIp(
          c.req.header("x-forwarded-for")
        ),
        userAgent: c.req.header("user-agent") ?? null,
      }
    )

    if (!verified) return unauthorized(c)

    c.set("whatsappOrganizationApiKey", verified)
    await next()
  }

/**
 * Mount the shared verifier on a system Hono router without coupling the
 * verifier itself to Hono, Elysia, or Next.js request types.
 */
export const mountWhatsappOrganizationApiKeyAuth = (
  app: Hono<WhatsappSystemApiEnv>,
  path = "*"
) => {
  app.use(path, createWhatsappOrganizationApiKeyMiddleware())
  return app
}
