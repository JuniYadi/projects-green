import { describe, expect, it } from "bun:test"
import { Elysia } from "elysia"

import { createAuthRoutes } from "@/modules/auth/api/auth.route"
import {
  AuthEmailAlreadyExistsError,
  AuthValidationError,
  InvalidAuthCredentialsError,
  MissingAuthConfigurationError,
} from "@/modules/auth/auth.service"

describe("authRoutes", () => {
  it("returns success for POST /auth/magic/request", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {},
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/magic/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "user@example.com",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      message: string
    }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.message).toContain("verification code")
  })

  it("returns 422 when magic request validation fails in service", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new AuthValidationError("Email is invalid")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/magic/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "user@example.com",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("returns response with session cookie for POST /auth/magic/verify", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": "wos-session=abc; Path=/; HttpOnly",
            },
          })
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/magic/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "user@example.com",
          code: "123456",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it("returns 401 for invalid magic verify credentials", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new InvalidAuthCredentialsError(
            "Invalid or expired verification code."
          )
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/magic/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "user@example.com",
          code: "bad",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_CREDENTIALS")
    expect(body.message).toBe("Invalid or expired verification code.")
  })

  it("returns 401 for invalid email verification completion", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new InvalidAuthCredentialsError(
            "Invalid or expired verification code."
          )
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/email-verification/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "bad",
          pendingAuthenticationToken: "token_123",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_CREDENTIALS")
  })

  it("returns 409 for signup conflict", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new AuthEmailAlreadyExistsError()
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          password: "12345678",
          confirmPassword: "12345678",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      fieldErrors?: Record<string, string[]>
    }

    expect(response.status).toBe(409)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("EMAIL_ALREADY_EXISTS")
    expect(body.fieldErrors?.email?.[0]).toBe(
      "An account with this email already exists."
    )
  })

  it("returns 500 when login config is missing", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new MissingAuthConfigurationError()
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "ada@example.com",
          password: "12345678",
        }),
      })
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
      message: string
    }

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    expect(body.message).toBe("Missing WorkOS auth configuration.")
  })

  it("returns 500 for generic error on magic/request", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("Unexpected failure")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/magic/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }
    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    expect(body.message).toBe("Unable to send the verification code right now.")
  })

  it("returns 500 when magic verify config is missing", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new MissingAuthConfigurationError()
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/magic/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", code: "123456" }),
      })
    )
    const body = (await response.json()) as { ok: boolean; message: string }
    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    expect(body.message).toBe("Missing WorkOS auth configuration.")
  })

  it("returns 422 for magic verify validation error", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new AuthValidationError("Invalid code format")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/magic/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", code: "123456" }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }
    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("returns 500 for generic error on magic/verify", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("Unexpected")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/magic/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", code: "123456" }),
      })
    )
    const body = (await response.json()) as { ok: boolean; message: string }
    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    expect(body.message).toBe("Unable to sign in right now.")
  })

  it("returns success for POST /auth/email-verification/complete", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/email-verification/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "123456",
          pendingAuthenticationToken: "token_abc",
        }),
      })
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it("returns 500 when email verification config is missing", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new MissingAuthConfigurationError()
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/email-verification/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "123456",
          pendingAuthenticationToken: "token_abc",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; message: string }
    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    expect(body.message).toBe("Missing WorkOS auth configuration.")
  })

  it("returns 422 for email verification validation error", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new AuthValidationError("Invalid code")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/email-verification/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "123456",
          pendingAuthenticationToken: "token_abc",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }
    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("returns 500 for generic error on email-verification/complete", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("Unexpected")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/email-verification/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: "123456",
          pendingAuthenticationToken: "token_abc",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; message: string }
    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    expect(body.message).toBe("Unable to verify email right now.")
  })

  it("returns success for POST /auth/signup", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          password: "12345678",
          confirmPassword: "12345678",
        }),
      })
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it("returns 422 for signup validation error", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new AuthValidationError("Invalid email")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          password: "12345678",
          confirmPassword: "12345678",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }
    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("VALIDATION_ERROR")
  })

  it("returns 500 for generic error on signup", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("Unexpected")
        },
        async login() {
          throw new Error("not used")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          password: "12345678",
          confirmPassword: "12345678",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; message: string }
    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    expect(body.message).toBe("Unable to create account right now.")
  })

  it("returns success for POST /auth/login", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@example.com",
          password: "12345678",
        }),
      })
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it("returns 401 for invalid login credentials", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new InvalidAuthCredentialsError("Invalid email or password.")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@example.com",
          password: "wrongpass",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; error: string }
    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INVALID_CREDENTIALS")
  })

  it("returns 500 for generic error on login", async () => {
    const app = new Elysia().use(
      createAuthRoutes({
        async requestMagicCode() {
          throw new Error("not used")
        },
        async verifyMagicCode() {
          throw new Error("not used")
        },
        async completeEmailVerification() {
          throw new Error("not used")
        },
        async signup() {
          throw new Error("not used")
        },
        async login() {
          throw new Error("Unexpected")
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@example.com",
          password: "12345678",
        }),
      })
    )
    const body = (await response.json()) as { ok: boolean; message: string }
    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("INTERNAL_SERVER_ERROR")
    expect(body.message).toBe("Unable to sign in right now.")
  })
})
