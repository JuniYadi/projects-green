import { Elysia } from "elysia"

type ApiRequestContext = {
  requestId: string
  startedAt: number
}

type ApiRequestLog = {
  timestamp: string
  level: "info"
  event: "api.request.completed"
  requestId: string
  method: string
  pathname: string
  statusCode: number
  durationMs: number
}

type ApiErrorLog = {
  timestamp: string
  level: "error"
  event: "api.request.error"
  requestId: string
  method: string
  pathname: string
  statusCode: number
  durationMs: number
  errorCode: string
}

type ApiLogStatus = {
  status?: number | string
}

const requestContexts = new WeakMap<Request, ApiRequestContext>()

const safeErrorCodes = new Set([
  "UNKNOWN",
  "PARSE",
  "INTERNAL_SERVER_ERROR",
  "INVALID_COOKIE_SIGNATURE",
  "INVALID_FILE_TYPE",
])

const sensitivePathMarker =
  /(?:authorization|api[-_]?key|bearer|credential|secret|token|webhook)/i

const redactSensitivePathname = (pathname: string) => {
  let redactNext = false

  return pathname
    .split("/")
    .map((segment) => {
      if (redactNext) {
        redactNext = false
        return "[REDACTED]"
      }

      if (sensitivePathMarker.test(segment)) {
        redactNext = true
      }

      return segment
    })
    .join("/")
}

const pathnameOf = (request: Request) =>
  redactSensitivePathname(new URL(request.url).pathname)

const contextFor = (request: Request): ApiRequestContext => {
  const existing = requestContexts.get(request)
  if (existing) {
    return existing
  }

  const context = {
    requestId: crypto.randomUUID(),
    startedAt: Date.now(),
  }
  requestContexts.set(request, context)
  return context
}

const durationSince = (startedAt: number) => Math.max(0, Date.now() - startedAt)

const isResponse = (value: unknown): value is Response =>
  typeof Response !== "undefined" && value instanceof Response

const statusCodeOf = (
  set: ApiLogStatus,
  response: unknown,
  fallback: number
) => {
  if (typeof set.status === "number" && Number.isFinite(set.status)) {
    return set.status
  }

  if (isResponse(response)) {
    return response.status
  }

  return fallback
}

const errorCodeOf = (code: unknown) =>
  typeof code === "string" && safeErrorCodes.has(code) ? code : "UNKNOWN"

const emit = (record: ApiRequestLog | ApiErrorLog) => {
  console.error(JSON.stringify(record))
}

const emitCompletion = (
  request: Request,
  context: ApiRequestContext,
  set: ApiLogStatus,
  response: unknown
) => {
  emit({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "api.request.completed",
    requestId: context.requestId,
    method: request.method,
    pathname: pathnameOf(request),
    statusCode: statusCodeOf(set, response, 200),
    durationMs: durationSince(context.startedAt),
  })
}

const emitError = (
  request: Request,
  context: ApiRequestContext,
  code: unknown
) => {
  emit({
    timestamp: new Date().toISOString(),
    level: "error",
    event: "api.request.error",
    requestId: context.requestId,
    method: request.method,
    pathname: pathnameOf(request),
    statusCode: 500,
    durationMs: durationSince(context.startedAt),
    errorCode: errorCodeOf(code),
  })
}

export const createApiLoggingPlugin = () =>
  new Elysia({ name: "api-logging" })
    .onRequest(({ request }) => {
      contextFor(request)
    })
    .onError(({ code, request }) => {
      if (code === "VALIDATION" || code === "NOT_FOUND") {
        return
      }

      emitError(request, contextFor(request), code)
    })
    .onAfterResponse(({ request, response, set }) => {
      const context = contextFor(request)

      try {
        emitCompletion(request, context, set, response)
      } finally {
        requestContexts.delete(request)
      }
    })
    .as("global")
