import { describe, expect, test } from "bun:test"
import { Elysia } from "elysia"

import { createApiLoggingPlugin } from "@/lib/api-logging"
import { logger } from "@/lib/logger"

const { app } = await import("@/lib/api")

type ApiLog = Record<string, unknown>

const waitForAfterResponse = () => {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, 20)
  return promise
}

const captureLogs = async (operation: () => Promise<Response>) => {
  const logs: ApiLog[] = []
  const originalInfo = logger.info.bind(logger)
  const originalError = logger.error.bind(logger)

  logger.info = ((obj: unknown, msg?: string) => {
    if (typeof obj === "object" && obj !== null) {
      logs.push({ ...(obj as Record<string, unknown>), msg })
    }
  }) as unknown as typeof logger.info

  logger.error = ((obj: unknown, msg?: string) => {
    if (typeof obj === "object" && obj !== null) {
      logs.push({ ...(obj as Record<string, unknown>), msg })
    }
  }) as unknown as typeof logger.error

  try {
    const response = await operation()
    await waitForAfterResponse()

    return {
      response,
      logs,
    }
  } finally {
    logger.info = originalInfo
    logger.error = originalError
  }
}

const completedLogKeys = [
  "caller",
  "durationMs",
  "event",
  "method",
  "msg",
  "pathname",
  "requestId",
  "statusCode",
]

const errorLogKeys = [...completedLogKeys, "errorCode"]

describe.serial("Elysia API logging", () => {
  test("logs a safe JSON completion record with caller identity for a 2xx request", async () => {
    const { response, logs } = await captureLogs(() =>
      app.handle(
        new Request(
          "http://localhost/api/health?apiKey=query-secret&token=token-secret",
          {
            method: "GET",
            headers: {
              Authorization: "Bearer authorization-secret",
              Cookie: "session=cookie-secret",
              "x-workos-authed": "true",
              "x-workos-user-id": "user_123",
              "x-workos-user-email": "user@example.com",
              "x-workos-organization-id": "org_456",
              "x-workos-session-role": "owner",
            },
          }
        )
      )
    )

    expect(response.status).toBe(200)
    expect(logs).toHaveLength(1)
    expect(Object.keys(logs[0]).sort()).toEqual([...completedLogKeys].sort())
    expect(logs[0]).toMatchObject({
      event: "api.request.completed",
      method: "GET",
      pathname: "/api/health",
      statusCode: 200,
      caller: {
        type: "workos",
        userId: "user_123",
        email: "user@example.com",
        organizationId: "org_456",
        orgRole: "owner",
      },
    })
    expect(logs[0].requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    expect(logs[0].durationMs).toBeGreaterThanOrEqual(0)

    const serializedLogs = JSON.stringify(logs)
    expect(serializedLogs).not.toContain("query-secret")
    expect(serializedLogs).not.toContain("token-secret")
    expect(serializedLogs).not.toContain("authorization-secret")
    expect(serializedLogs).not.toContain("cookie-secret")
  })

  test("logs caller identity correctly when x-workos-session-roles array header is provided", async () => {
    const testApp = new Elysia()
      .use(createApiLoggingPlugin())
      .get("/api/roles-test", () => ({ ok: true }))

    const { response, logs } = await captureLogs(() =>
      testApp.handle(
        new Request("http://localhost/api/roles-test", {
          method: "GET",
          headers: {
            "x-workos-authed": "true",
            "x-workos-user-id": "user_789",
            "x-workos-user-email": "admin@example.com",
            "x-workos-organization-id": "org_999",
            "x-workos-session-roles": JSON.stringify(["user_admin"]),
          },
        })
      )
    )

    expect(response.status).toBe(200)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      event: "api.request.completed",
      method: "GET",
      pathname: "/api/roles-test",
      statusCode: 200,
      caller: {
        type: "workos",
        userId: "user_789",
        email: "admin@example.com",
        organizationId: "org_999",
        orgRole: "admin",
      },
    })
  })

  test("logs request body with sensitive fields redacted", async () => {
    const testApp = new Elysia()
      .use(createApiLoggingPlugin())
      .post("/test-body", ({ body }) => ({ ok: true, data: body }))

    const { response, logs } = await captureLogs(() =>
      testApp.handle(
        new Request("http://localhost/test-body", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "john_doe",
            password: "super-secret-password",
            apiKey: "my-api-key",
            meta: {
              nestedSecret: "classified-token",
              visibleData: "hello",
            },
          }),
        })
      )
    )

    expect(response.status).toBe(200)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      event: "api.request.completed",
      method: "POST",
      pathname: "/test-body",
      statusCode: 200,
      body: {
        username: "john_doe",
        password: "[REDACTED]",
        apiKey: "[REDACTED]",
        meta: {
          nestedSecret: "[REDACTED]",
          visibleData: "hello",
        },
      },
    })

    const serializedLogs = JSON.stringify(logs)
    expect(serializedLogs).not.toContain("super-secret-password")
    expect(serializedLogs).not.toContain("my-api-key")
    expect(serializedLogs).not.toContain("classified-token")
  })

  test("logs a 4xx completion without an error record", async () => {
    const { response, logs } = await captureLogs(() =>
      app.handle(
        new Request("http://localhost/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )
    )

    expect(response.status).toBe(422)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      event: "api.request.completed",
      method: "POST",
      pathname: "/api/user",
      statusCode: 422,
    })
  })

  test("logs unexpected 5xx errors with caller info without leaking stack/error secrets", async () => {
    const errorApp = new Elysia()
      .use(createApiLoggingPlugin())
      .onError(({ set }) => {
        set.status = 500
        return { ok: false, error: "INTERNAL_SERVER_ERROR" }
      })
      .get("/webhook/:key", () => {
        throw new Error("synthetic-error-secret")
      })

    const { response, logs } = await captureLogs(() =>
      errorApp.handle(
        new Request(
          "http://localhost/webhook/path-secret?apiKey=query-secret",
          {
            headers: {
              Authorization: "Bearer authorization-secret",
              Cookie: "session=cookie-secret",
            },
          }
        )
      )
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      ok: false,
      error: "INTERNAL_SERVER_ERROR",
    })
    expect(logs).toHaveLength(2)

    const errorLog = logs.find((log) => log.event === "api.request.error")
    const completedLog = logs.find(
      (log) => log.event === "api.request.completed"
    )

    expect(errorLog).toBeDefined()
    expect(completedLog).toBeDefined()
    expect(Object.keys(errorLog ?? {}).sort()).toEqual([...errorLogKeys].sort())
    expect(errorLog).toMatchObject({
      errorCode: "UNKNOWN",
      event: "api.request.error",
      method: "GET",
      pathname: "/webhook/[REDACTED]",
      statusCode: 500,
    })
    expect(completedLog).toMatchObject({
      event: "api.request.completed",
      method: "GET",
      pathname: "/webhook/[REDACTED]",
      statusCode: 500,
    })
    expect(errorLog?.requestId).toBe(completedLog?.requestId)

    const serializedLogs = JSON.stringify(logs)
    expect(serializedLogs).not.toContain("synthetic-error-secret")
    expect(serializedLogs).not.toContain("path-secret")
    expect(serializedLogs).not.toContain("query-secret")
    expect(serializedLogs).not.toContain("authorization-secret")
    expect(serializedLogs).not.toContain("cookie-secret")
  })

  test("logs anonymous caller and does not block when auth is unauthenticated or delayed", async () => {
    const publicApp = new Elysia()
      .use(createApiLoggingPlugin())
      .get("/public", () => ({ ok: true }))

    const { response, logs } = await captureLogs(() =>
      publicApp.handle(
        new Request("http://localhost/public", { method: "GET" })
      )
    )

    expect(response.status).toBe(200)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      event: "api.request.completed",
      method: "GET",
      pathname: "/public",
      statusCode: 200,
      caller: {
        type: "anonymous",
      },
    })
  })
})
