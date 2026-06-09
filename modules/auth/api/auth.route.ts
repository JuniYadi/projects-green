import { Elysia } from "elysia"
import { z } from "zod"

import { loginSchema, signupSchema } from "@/lib/validation"
import {
  AuthEmailAlreadyExistsError,
  AuthService,
  authService,
  AuthValidationError,
  InvalidAuthCredentialsError,
  MissingAuthConfigurationError,
} from "@/modules/auth/auth.service"

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

export const createAuthRoutes = (service: AuthService = authService) =>
  new Elysia()
    .post(
      "/auth/magic/request",
      async ({ body, set }) => {
        try {
          await service.requestMagicCode({
            email: body.email,
          })

          return {
            ok: true as const,
            message: "If an account exists, we've sent a verification code.",
          }
        } catch (error) {
          if (error instanceof AuthValidationError) {
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
        try {
          return await service.verifyMagicCode({
            email: body.email,
            code: body.code,
            requestUrl: request.url,
          })
        } catch (error) {
          if (error instanceof MissingAuthConfigurationError) {
            set.status = 500
            return {
              ok: false as const,
              error: "INTERNAL_SERVER_ERROR" as const,
              message: "Missing WorkOS auth configuration.",
            }
          }

          if (error instanceof InvalidAuthCredentialsError) {
            set.status = 401
            return {
              ok: false as const,
              error: "INVALID_CREDENTIALS" as const,
              message: error.message,
            }
          }

          if (error instanceof AuthValidationError) {
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
        try {
          return await service.completeEmailVerification({
            code: body.code,
            pendingAuthenticationToken: body.pendingAuthenticationToken,
            requestUrl: request.url,
          })
        } catch (error) {
          if (error instanceof MissingAuthConfigurationError) {
            set.status = 500
            return {
              ok: false as const,
              error: "INTERNAL_SERVER_ERROR" as const,
              message: "Missing WorkOS auth configuration.",
            }
          }

          if (error instanceof InvalidAuthCredentialsError) {
            set.status = 401
            return {
              ok: false as const,
              error: "INVALID_CREDENTIALS" as const,
              message: error.message,
            }
          }

          if (error instanceof AuthValidationError) {
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
        try {
          return await service.signup({
            name: body.name,
            email: body.email,
            password: body.password,
            requestUrl: request.url,
          })
        } catch (error) {
          if (error instanceof MissingAuthConfigurationError) {
            set.status = 500
            return {
              ok: false as const,
              error: "INTERNAL_SERVER_ERROR" as const,
              message: "Missing WorkOS auth configuration.",
            }
          }

          if (error instanceof AuthEmailAlreadyExistsError) {
            set.status = 409
            return {
              ok: false as const,
              error: "EMAIL_ALREADY_EXISTS" as const,
              message: error.message,
              fieldErrors: {
                email: [error.message],
              },
            }
          }

          if (error instanceof AuthValidationError) {
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
        try {
          return await service.login({
            email: body.email,
            password: body.password,
            requestUrl: request.url,
          })
        } catch (error) {
          if (error instanceof MissingAuthConfigurationError) {
            set.status = 500
            return {
              ok: false as const,
              error: "INTERNAL_SERVER_ERROR" as const,
              message: "Missing WorkOS auth configuration.",
            }
          }

          if (error instanceof InvalidAuthCredentialsError) {
            set.status = 401
            return {
              ok: false as const,
              error: "INVALID_CREDENTIALS" as const,
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
        body: loginSchema,
      }
    )

export const authRoutes = createAuthRoutes()
