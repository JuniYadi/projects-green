import { Prisma } from "@prisma/client"
import {
  AuthenticationException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@workos-inc/node"
import { getWorkOS } from "@workos-inc/authkit-nextjs"
import { Elysia } from "elysia"
import { openapi } from "@elysia/openapi"
import { z } from "zod"

import { prisma } from "@/lib/prisma"
import { loginSchema, signupSchema } from "@/lib/validation"
import { docsRoutes } from "@/modules/docs/api/docs.route"
import { tenantsRoutes } from "@/modules/tenants/api/tenants.route"

const getWorkosClientId = () => process.env.WORKOS_CLIENT_ID?.trim()

const getWorkosCookiePassword = () => process.env.WORKOS_COOKIE_PASSWORD?.trim()

const getCookieMaxAge = () => {
  const raw = process.env.WORKOS_COOKIE_MAX_AGE
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN

  return Number.isFinite(parsed) ? parsed : 60 * 60 * 24 * 400
}

const getSessionCookieHeader = (sessionData: string, requestUrl: string) => {
  const cookieName = process.env.WORKOS_COOKIE_NAME?.trim() || "wos-session"
  const cookieDomain = process.env.WORKOS_COOKIE_DOMAIN?.trim()
  const sameSite = (process.env.WORKOS_COOKIE_SAMESITE?.trim() || "lax")
    .toLowerCase()
  const safeSameSite =
    sameSite === "none" || sameSite === "strict" || sameSite === "lax"
      ? sameSite
      : "lax"

  const protocol = new URL(requestUrl).protocol
  const secure = safeSameSite === "none" || protocol === "https:"

  const parts = [
    `${cookieName}=${sessionData}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${safeSameSite.charAt(0).toUpperCase()}${safeSameSite.slice(1)}`,
    `Max-Age=${getCookieMaxAge()}`,
  ]

  if (cookieDomain) {
    parts.push(`Domain=${cookieDomain}`)
  }

  if (secure) {
    parts.push("Secure")
  }

  return parts.join("; ")
}

const splitName = (name: string) => {
  const [firstName, ...rest] = name.trim().split(/\s+/)

  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(" ") : undefined,
  }
}

const userCreateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters"),
  email: z.email("Please enter a valid email address"),
})

const magicRequestSchema = z.object({
  email: z.email("Please enter a valid email address"),
})

const magicVerifySchema = z.object({
  email: z.email("Please enter a valid email address"),
  code: z
    .string()
    .trim()
    .min(1, "Please enter the verification code from your email."),
})

const emailVerificationCompleteSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Please enter the verification code from your email."),
  pendingAuthenticationToken: z
    .string()
    .trim()
    .min(1, "Missing pending authentication token."),
})

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
  .use(docsRoutes)
  .use(tenantsRoutes)
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
  .post(
    "/user",
    async ({ body, set }) => {
      try {
        const user = await prisma.user.create({
          data: {
            name: body.name,
            email: body.email,
          },
        })

        set.status = 201

        return {
          ok: true as const,
          user,
        }
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          set.status = 409
          return {
            ok: false as const,
            error: "EMAIL_ALREADY_EXISTS" as const,
            message: "This email address is already in use.",
          }
        }

        throw error
      }
    },
    {
      body: userCreateSchema,
    }
  )
  .post(
    "/auth/magic/request",
    async ({ body, set }) => {
      try {
        await getWorkOS().userManagement.createMagicAuth({
          email: body.email,
        })

        return {
          ok: true as const,
          message: "If an account exists, we've sent a verification code.",
        }
      } catch (error) {
        if (error instanceof NotFoundException) {
          return {
            ok: true as const,
            message: "If an account exists, we've sent a verification code.",
          }
        }

        if (error instanceof UnprocessableEntityException) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: error.message,
          }
        }

        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Unable to send the verification code right now.",
        }
      }
    },
    {
      body: magicRequestSchema,
    }
  )
  .post(
    "/auth/magic/verify",
    async ({ body, request, set }) => {
      const clientId = getWorkosClientId()
      const cookiePassword = getWorkosCookiePassword()

      if (!clientId || !cookiePassword) {
        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Missing WorkOS auth configuration.",
        }
      }

      try {
        const authResponse =
          await getWorkOS().userManagement.authenticateWithMagicAuth({
            clientId,
            email: body.email,
            code: body.code,
            session: {
              sealSession: true,
              cookiePassword,
            },
          })

        if (!authResponse.sealedSession) {
          throw new Error("Failed to create session.")
        }

        return new Response(JSON.stringify({ ok: true as const }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": getSessionCookieHeader(
              authResponse.sealedSession,
              request.url
            ),
          },
        })
      } catch (error) {
        if (
          error instanceof UnauthorizedException ||
          error instanceof AuthenticationException ||
          error instanceof NotFoundException
        ) {
          set.status = 401
          return {
            ok: false as const,
            error: "INVALID_CREDENTIALS" as const,
            message: "Invalid or expired verification code.",
          }
        }

        if (error instanceof UnprocessableEntityException) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: error.message,
          }
        }

        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Unable to sign in right now.",
        }
      }
    },
    {
      body: magicVerifySchema,
    }
  )
  .post(
    "/auth/email-verification/complete",
    async ({ body, request, set }) => {
      const clientId = getWorkosClientId()
      const cookiePassword = getWorkosCookiePassword()

      if (!clientId || !cookiePassword) {
        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Missing WorkOS auth configuration.",
        }
      }

      try {
        const authResponse =
          await getWorkOS().userManagement.authenticateWithEmailVerification({
            clientId,
            code: body.code,
            pendingAuthenticationToken: body.pendingAuthenticationToken,
            session: {
              sealSession: true,
              cookiePassword,
            },
          })

        if (!authResponse.sealedSession) {
          throw new Error("Failed to create session.")
        }

        return new Response(JSON.stringify({ ok: true as const }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": getSessionCookieHeader(
              authResponse.sealedSession,
              request.url
            ),
          },
        })
      } catch (error) {
        if (
          error instanceof UnauthorizedException ||
          error instanceof AuthenticationException ||
          error instanceof NotFoundException
        ) {
          set.status = 401
          return {
            ok: false as const,
            error: "INVALID_CREDENTIALS" as const,
            message: "Invalid or expired verification code.",
          }
        }

        if (error instanceof UnprocessableEntityException) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: error.message,
          }
        }

        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Unable to verify email right now.",
        }
      }
    },
    {
      body: emailVerificationCompleteSchema,
    }
  )
  .post(
    "/auth/signup",
    async ({ body, request, set }) => {
      const clientId = getWorkosClientId()
      const cookiePassword = getWorkosCookiePassword()

      if (!clientId || !cookiePassword) {
        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Missing WorkOS auth configuration.",
        }
      }

      const { firstName, lastName } = splitName(body.name)

      try {
        await getWorkOS().userManagement.createUser({
          email: body.email,
          password: body.password,
          firstName,
          lastName,
        })

        const authResponse =
          await getWorkOS().userManagement.authenticateWithPassword({
            clientId,
            email: body.email,
            password: body.password,
            session: {
              sealSession: true,
              cookiePassword,
            },
          })

        if (!authResponse.sealedSession) {
          throw new Error("Failed to create session.")
        }

        return new Response(JSON.stringify({ ok: true as const }), {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": getSessionCookieHeader(
              authResponse.sealedSession,
              request.url
            ),
          },
        })
      } catch (error) {
        if (error instanceof ConflictException) {
          set.status = 409
          return {
            ok: false as const,
            error: "EMAIL_ALREADY_EXISTS" as const,
            message: "An account with this email already exists.",
            fieldErrors: {
              email: ["An account with this email already exists."],
            },
          }
        }

        if (error instanceof UnprocessableEntityException) {
          set.status = 422
          return {
            ok: false as const,
            error: "VALIDATION_ERROR" as const,
            message: error.message,
          }
        }

        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Unable to create account right now.",
        }
      }
    },
    {
      body: signupSchema,
    }
  )
  .post(
    "/auth/login",
    async ({ body, request, set }) => {
      const clientId = getWorkosClientId()
      const cookiePassword = getWorkosCookiePassword()

      if (!clientId || !cookiePassword) {
        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Missing WorkOS auth configuration.",
        }
      }

      try {
        const authResponse =
          await getWorkOS().userManagement.authenticateWithPassword({
            clientId,
            email: body.email,
            password: body.password,
            session: {
              sealSession: true,
              cookiePassword,
            },
          })

        if (!authResponse.sealedSession) {
          throw new Error("Failed to create session.")
        }

        return new Response(JSON.stringify({ ok: true as const }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": getSessionCookieHeader(
              authResponse.sealedSession,
              request.url
            ),
          },
        })
      } catch (error) {
        if (
          error instanceof UnauthorizedException ||
          error instanceof AuthenticationException
        ) {
          set.status = 401
          return {
            ok: false as const,
            error: "INVALID_CREDENTIALS" as const,
            message: "Invalid email or password.",
          }
        }

        set.status = 500
        return {
          ok: false as const,
          error: "INTERNAL_SERVER_ERROR" as const,
          message: "Unable to sign in right now.",
        }
      }
    },
    {
      body: loginSchema,
    }
  )
  .get(
    "/user/:id",
    async ({ params, set }) => {
      const user = await prisma.user.findUnique({
        where: {
          id: params.id,
        },
      })

      if (!user) {
        set.status = 404
        return {
          ok: false as const,
          error: "USER_NOT_FOUND" as const,
          message: "User does not exist.",
        }
      }

      return {
        ok: true as const,
        user,
      }
    },
    {
      params: z.object({
        id: z.string().min(1),
      }),
    }
  )

export type App = typeof app
