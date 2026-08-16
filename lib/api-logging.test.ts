import { describe, expect, mock, test } from "bun:test"
import { Elysia } from "elysia"

import { createApiLoggingPlugin } from "@/lib/api-logging"

mock.module("@/modules/vpn/sessions/stale-cleanup", () => ({
  startStaleSessionCleanup: mock(),
}))

const { app } = await import("@/lib/api")

type ApiLog = Record<string, unknown>

const waitForAfterResponse = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 10))

const captureLogs = async (operation: () => Promise<Response>) => {
  const lines: string[] = []
  const originalError = console.error

  console.error = (...args: unknown[]) => {
    lines.push(args.map((arg) => String(arg)).join(" "))
  }

  try {
    const response = await operation()
    await waitForAfterResponse()

    return {
      response,
      logs: lines.map((line) => JSON.parse(line) as ApiLog),
    }
  } finally {
    console.error = originalError
  }
}

const completedLogKeys = [
  "durationMs",
  "event",
  "level",
  "method",
  "pathname",
  "requestId",
  "statusCode",
  "timestamp",
]

const errorLogKeys = [...completedLogKeys, "errorCode"]

describe.serial("Elysia API logging", () => {
  test("logs a safe JSON completion record for a 2xx request", async () => {
    const { response, logs } = await captureLogs(() =>
      app.handle(
        new Request(
          "http://localhost/api/echo?apiKey=query-secret&token=token-secret",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer authorization-secret",
              Cookie: "session=cookie-secret",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "request-body-secret" }),
          }
        )
      )
    )

    expect(response.status).toBe(200)
    expect(logs).toHaveLength(1)
    expect(Object.keys(logs[0]).sort()).toEqual([...completedLogKeys].sort())
    expect(logs[0]).toMatchObject({
      event: "api.request.completed",
      level: "info",
      method: "POST",
      pathname: "/api/echo",
      statusCode: 200,
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
    expect(serializedLogs).not.toContain("request-body-secret")
  })

  test("logs a 4xx completion without an error record", async () => {
    const { response, logs } = await captureLogs(() =>
      app.handle(
        new Request("http://localhost/api/echo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )
    )

    expect(response.status).toBe(422)
    expect(logs).toHaveLength(1)
    expect(Object.keys(logs[0]).sort()).toEqual([...completedLogKeys].sort())
    expect(logs[0]).toMatchObject({
      event: "api.request.completed",
      level: "info",
      method: "POST",
      pathname: "/api/echo",
      statusCode: 422,
    })
  })

  test("logs unexpected 5xx errors without serializing the error", async () => {
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
      level: "error",
      method: "GET",
      pathname: "/webhook/[REDACTED]",
      statusCode: 500,
    })
    expect(completedLog).toMatchObject({
      event: "api.request.completed",
      level: "info",
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
})
