import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import {
  AuthEmailAlreadyExistsError,
  AuthValidationError,
  InvalidAuthCredentialsError,
  MissingAuthConfigurationError,
} from "@/modules/auth/auth.service"

const MANAGED_ENV_KEYS = [
  "WORKOS_CLIENT_ID",
  "WORKOS_COOKIE_PASSWORD",
  "WORKOS_COOKIE_NAME",
  "WORKOS_COOKIE_DOMAIN",
  "WORKOS_COOKIE_SAMESITE",
  "WORKOS_COOKIE_MAX_AGE",
] as const

type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number]

const mockCreateMagicAuth = mock(async () => ({}))
const mockAuthenticateWithMagicAuth = mock(async () => ({
  sealedSession: "sealed_session_abc",
}))
const mockAuthenticateWithEmailVerification = mock(async () => ({
  sealedSession: "sealed_session_abc",
}))
const mockCreateUser = mock(async () => ({ id: "user_new" }))
const mockAuthenticateWithPassword = mock(async () => ({
  sealedSession: "sealed_session_abc",
}))

mock.module("@workos-inc/authkit-nextjs", () => ({
  getWorkOS: () => ({
    userManagement: {
      createMagicAuth: mockCreateMagicAuth,
      authenticateWithMagicAuth: mockAuthenticateWithMagicAuth,
      authenticateWithEmailVerification: mockAuthenticateWithEmailVerification,
      createUser: mockCreateUser,
      authenticateWithPassword: mockAuthenticateWithPassword,
    },
  }),
}))

// Import auth service after mocks
const { authService } = await import("@/modules/auth/auth.service")

describe("authService", () => {
  let savedEnv: Partial<Record<ManagedEnvKey, string | undefined>> = {}

  beforeEach(() => {
    savedEnv = Object.fromEntries(
      MANAGED_ENV_KEYS.map((key) => [key, process.env[key]])
    ) as Partial<Record<ManagedEnvKey, string | undefined>>

    process.env.WORKOS_CLIENT_ID = "client_test"
    process.env.WORKOS_COOKIE_PASSWORD =
      "cookie_password_at_least_32_characters_long!!"
    process.env.WORKOS_COOKIE_NAME = "wos-session"
    process.env.WORKOS_COOKIE_DOMAIN = ""
    process.env.WORKOS_COOKIE_SAMESITE = "lax"
    process.env.WORKOS_COOKIE_MAX_AGE = ""

    mockCreateMagicAuth.mockClear()
    mockAuthenticateWithMagicAuth.mockClear()
    mockAuthenticateWithEmailVerification.mockClear()
    mockCreateUser.mockClear()
    mockAuthenticateWithPassword.mockClear()

    mockCreateMagicAuth.mockImplementation(async () => ({}))
    mockAuthenticateWithMagicAuth.mockImplementation(async () => ({
      sealedSession: "sealed_session_abc",
    }))
    mockAuthenticateWithEmailVerification.mockImplementation(async () => ({
      sealedSession: "sealed_session_abc",
    }))
    mockCreateUser.mockImplementation(async () => ({ id: "user_new" }))
    mockAuthenticateWithPassword.mockImplementation(async () => ({
      sealedSession: "sealed_session_abc",
    }))
  })

  afterEach(() => {
    for (const key of MANAGED_ENV_KEYS) {
      const value = savedEnv[key]
      if (value === undefined) {
        delete process.env[key]
        continue
      }

      process.env[key] = value
    }
  })

  describe("error classes", () => {
    it("creates MissingAuthConfigurationError", () => {
      const err = new MissingAuthConfigurationError()
      expect(err.name).toBe("MissingAuthConfigurationError")
      expect(err.message).toBe("Missing WorkOS auth configuration.")
    })

    it("creates InvalidAuthCredentialsError", () => {
      const err = new InvalidAuthCredentialsError("bad creds")
      expect(err.name).toBe("InvalidAuthCredentialsError")
      expect(err.message).toBe("bad creds")
    })

    it("creates AuthValidationError", () => {
      const err = new AuthValidationError("invalid field")
      expect(err.name).toBe("AuthValidationError")
      expect(err.message).toBe("invalid field")
    })

    it("creates AuthEmailAlreadyExistsError", () => {
      const err = new AuthEmailAlreadyExistsError()
      expect(err.name).toBe("AuthEmailAlreadyExistsError")
      expect(err.message).toBe("An account with this email already exists.")
    })
  })

  describe("requestMagicCode", () => {
    it("calls createMagicAuth with email", async () => {
      await authService.requestMagicCode({ email: "user@example.com" })
      expect(mockCreateMagicAuth).toHaveBeenCalledWith({
        email: "user@example.com",
      })
    })

    it("silently swallows NotFoundException", async () => {
      const { NotFoundException } = await import("@workos-inc/node")
      mockCreateMagicAuth.mockImplementation(async () => {
        throw new NotFoundException({
          message: "not found",
          code: "not_found",
          path: "/path/to/resource",
          requestID: "req_1",
        })
      })

      // Should not throw
      await authService.requestMagicCode({ email: "missing@example.com" })
    })

    it("throws AuthValidationError for UnprocessableEntityException", async () => {
      const { UnprocessableEntityException } = await import("@workos-inc/node")
      mockCreateMagicAuth.mockImplementation(async () => {
        throw new UnprocessableEntityException({
          message: "invalid email",
          code: "unprocessable",
          requestID: "req_1",
          errors: [],
        })
      })

      await expect(
        authService.requestMagicCode({ email: "bad" })
      ).rejects.toThrow(AuthValidationError)
    })

    it("re-throws unknown errors", async () => {
      mockCreateMagicAuth.mockImplementation(async () => {
        throw new Error("unexpected error")
      })

      await expect(
        authService.requestMagicCode({ email: "user@example.com" })
      ).rejects.toThrow("unexpected error")
    })
  })

  describe("verifyMagicCode", () => {
    it("returns session response on success", async () => {
      const response = await authService.verifyMagicCode({
        email: "user@example.com",
        code: "123456",
        requestUrl: "http://localhost/auth/magic/verify",
      })

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })

    it("forwards invitationToken when provided", async () => {
      await authService.verifyMagicCode({
        email: "user@example.com",
        code: "123456",
        requestUrl: "http://localhost/auth/magic/verify",
        invitationToken: "invitation_token_abc",
      })

      expect(mockAuthenticateWithMagicAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          invitationToken: "invitation_token_abc",
        })
      )
    })

    it("omits invitationToken when not provided", async () => {
      await authService.verifyMagicCode({
        email: "user@example.com",
        code: "123456",
        requestUrl: "http://localhost/auth/magic/verify",
      })

      const calls = mockAuthenticateWithMagicAuth.mock.calls as unknown as Array<
        Array<Record<string, unknown>>
      >
      const call = calls.at(-1)?.[0]
      expect(call && "invitationToken" in call).toBe(false)
    })

    it("throws MissingAuthConfigurationError when env is missing", async () => {
      delete process.env.WORKOS_CLIENT_ID

      await expect(
        authService.verifyMagicCode({
          email: "user@example.com",
          code: "123456",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(MissingAuthConfigurationError)
    })

    it("throws InvalidAuthCredentialsError for unauthorized", async () => {
      const { UnauthorizedException } = await import("@workos-inc/node")
      mockAuthenticateWithMagicAuth.mockImplementation(async () => {
        throw new UnauthorizedException("req_1")
      })

      await expect(
        authService.verifyMagicCode({
          email: "user@example.com",
          code: "wrong",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(InvalidAuthCredentialsError)
    })

    it("throws InvalidAuthCredentialsError for authentication exception", async () => {
      const { AuthenticationException } = await import("@workos-inc/node")
      mockAuthenticateWithMagicAuth.mockImplementation(async () => {
        throw new AuthenticationException(
          401,
          { code: "email_verification_required", message: "auth failed" },
          "req_1"
        )
      })

      await expect(
        authService.verifyMagicCode({
          email: "user@example.com",
          code: "wrong",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(InvalidAuthCredentialsError)
    })

    it("throws AuthValidationError for unprocessable entity", async () => {
      const { UnprocessableEntityException } = await import("@workos-inc/node")
      mockAuthenticateWithMagicAuth.mockImplementation(async () => {
        throw new UnprocessableEntityException({
          message: "bad request",
          code: "unprocessable",
          requestID: "req_1",
          errors: [],
        })
      })

      await expect(
        authService.verifyMagicCode({
          email: "user@example.com",
          code: "abc",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(AuthValidationError)
    })

    it("throws when sealed session is null", async () => {
      mockAuthenticateWithMagicAuth.mockImplementation(async () => ({
        sealedSession: null,
      }) as unknown as { sealedSession: string })

      await expect(
        authService.verifyMagicCode({
          email: "user@example.com",
          code: "123456",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow("Failed to create session.")
    })
  })

  describe("completeEmailVerification", () => {
    it("returns session response on success", async () => {
      const response = await authService.completeEmailVerification({
        code: "123456",
        pendingAuthenticationToken: "token_abc",
        requestUrl: "http://localhost/auth/email-verification/complete",
      })

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })

    it("throws InvalidAuthCredentialsError for NotFoundException", async () => {
      const { NotFoundException } = await import("@workos-inc/node")
      mockAuthenticateWithEmailVerification.mockImplementation(async () => {
        throw new NotFoundException({
          message: "not found",
          code: "not_found",
          path: "/path/to/resource",
          requestID: "req_1",
        })
      })

      await expect(
        authService.completeEmailVerification({
          code: "wrong",
          pendingAuthenticationToken: "token",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(InvalidAuthCredentialsError)
    })

    it("throws AuthValidationError for unprocessable entity", async () => {
      const { UnprocessableEntityException } = await import("@workos-inc/node")
      mockAuthenticateWithEmailVerification.mockImplementation(async () => {
        throw new UnprocessableEntityException({
          message: "bad",
          code: "unprocessable",
          requestID: "req_1",
          errors: [],
        })
      })

      await expect(
        authService.completeEmailVerification({
          code: "abc",
          pendingAuthenticationToken: "token",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(AuthValidationError)
    })

    it("re-throws unknown errors", async () => {
      mockAuthenticateWithEmailVerification.mockImplementation(async () => {
        throw new Error("unexpected")
      })

      await expect(
        authService.completeEmailVerification({
          code: "123456",
          pendingAuthenticationToken: "token",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow("unexpected")
    })
  })

  describe("signup", () => {
    it("returns 201 session response on success", async () => {
      const response = await authService.signup({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "password123",
        requestUrl: "http://localhost/auth/signup",
      })

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(201)
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "password123",
        firstName: "Ada",
        lastName: "Lovelace",
      })
    })

    it("handles single-word name", async () => {
      await authService.signup({
        name: "Madonna",
        email: "madonna@example.com",
        password: "password123",
        requestUrl: "http://localhost/auth/signup",
      })

      expect(mockCreateUser).toHaveBeenCalledWith({
        email: "madonna@example.com",
        password: "password123",
        firstName: "Madonna",
        lastName: undefined,
      })
    })

    it("handles multi-word last name", async () => {
      await authService.signup({
        name: "Jean Claude Van Damme",
        email: "jcvd@example.com",
        password: "password123",
        requestUrl: "http://localhost/auth/signup",
      })

      expect(mockCreateUser).toHaveBeenCalledWith({
        email: "jcvd@example.com",
        password: "password123",
        firstName: "Jean",
        lastName: "Claude Van Damme",
      })
    })

    it("throws AuthEmailAlreadyExistsError on conflict", async () => {
      const { ConflictException } = await import("@workos-inc/node")
      mockCreateUser.mockImplementation(async () => {
        throw new ConflictException({
          message: "conflict",
          code: "conflict",
          requestID: "req_1",
        })
      })

      await expect(
        authService.signup({
          name: "Test User",
          email: "existing@example.com",
          password: "password123",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(AuthEmailAlreadyExistsError)
    })

    it("throws AuthValidationError for unprocessable entity", async () => {
      const { UnprocessableEntityException } = await import("@workos-inc/node")
      mockCreateUser.mockImplementation(async () => {
        throw new UnprocessableEntityException({
          message: "password too weak",
          code: "unprocessable",
          requestID: "req_1",
          errors: [],
        })
      })

      await expect(
        authService.signup({
          name: "Test User",
          email: "user@example.com",
          password: "weak",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(AuthValidationError)
    })

    it("re-throws unknown errors", async () => {
      mockCreateUser.mockImplementation(async () => {
        throw new Error("server down")
      })

      await expect(
        authService.signup({
          name: "Test User",
          email: "user@example.com",
          password: "password123",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow("server down")
    })
  })

  describe("login", () => {
    it("returns session response on success", async () => {
      const response = await authService.login({
        email: "user@example.com",
        password: "password123",
        requestUrl: "http://localhost/auth/login",
      })

      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })

    it("throws InvalidAuthCredentialsError for unauthorized", async () => {
      const { UnauthorizedException } = await import("@workos-inc/node")
      mockAuthenticateWithPassword.mockImplementation(async () => {
        throw new UnauthorizedException("req_1")
      })

      await expect(
        authService.login({
          email: "user@example.com",
          password: "wrong",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(InvalidAuthCredentialsError)
    })

    it("throws InvalidAuthCredentialsError for auth exception", async () => {
      const { AuthenticationException } = await import("@workos-inc/node")
      mockAuthenticateWithPassword.mockImplementation(async () => {
        throw new AuthenticationException(
          401,
          { code: "email_verification_required", message: "auth failed" },
          "req_1"
        )
      })

      await expect(
        authService.login({
          email: "user@example.com",
          password: "wrong",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow(InvalidAuthCredentialsError)
    })

    it("re-throws unknown errors", async () => {
      mockAuthenticateWithPassword.mockImplementation(async () => {
        throw new Error("network down")
      })

      await expect(
        authService.login({
          email: "user@example.com",
          password: "password123",
          requestUrl: "http://localhost",
        })
      ).rejects.toThrow("network down")
    })
  })

  describe("session response structure", () => {
    it("returns response with correct content-type", async () => {
      const response = await authService.login({
        email: "user@example.com",
        password: "password123",
        requestUrl: "http://localhost/auth/login",
      })

      expect(response.headers.get("Content-Type")).toBe("application/json")
    })

    it("signup returns 201 status", async () => {
      const response = await authService.signup({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
        requestUrl: "http://localhost/auth/signup",
      })

      expect(response.status).toBe(201)
      const body = await response.json()
      expect(body.ok).toBe(true)
    })

    it("verifyMagicCode returns 200 status", async () => {
      const response = await authService.verifyMagicCode({
        email: "user@example.com",
        code: "123456",
        requestUrl: "http://localhost/auth/magic/verify",
      })

      expect(response.status).toBe(200)
    })

    it("completeEmailVerification returns 200 status", async () => {
      const response = await authService.completeEmailVerification({
        code: "123456",
        pendingAuthenticationToken: "token_abc",
        requestUrl: "http://localhost/auth/email-verification/complete",
      })

      expect(response.status).toBe(200)
    })
  })
})
