import { Elysia } from "elysia"
import { logger } from "@/lib/logger"
import {
  resolveAuthContext,
  type ResolvedAuth,
} from "@/lib/auth/resolve-proxy-auth"

export type ApiRequestContext = {
  requestId: string
  startedAt: number
  auth?: ResolvedAuth | null
  body?: unknown
}

const requestContexts = new WeakMap<Request, ApiRequestContext>()

const safeErrorCodes: Record<string, true> = {
  UNKNOWN: true,
  PARSE: true,
  INTERNAL_SERVER_ERROR: true,
  INVALID_COOKIE_SIGNATURE: true,
  INVALID_FILE_TYPE: true,
}

const sensitiveFieldMarker =
  /password|secret|token|key|authorization|cookie|credential|bearer|session/i

const sensitivePathMarker =
  /(?:authorization|api[-_]?key|bearer|credential|secret|token|webhook)/i

export const redactSensitivePathname = (pathname: string) => {
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

export const redactSensitiveData = (data: unknown, depth = 0): unknown => {
  if (depth > 5) return "[DEPTH_LIMIT]"
  if (data === null || data === undefined) return data

  if (typeof data === "string") {
    if (data.length > 2000) {
      return `${data.slice(0, 2000)}...[TRUNCATED]`
    }
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item, depth + 1))
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>
    )) {
      if (sensitiveFieldMarker.test(key)) {
        sanitized[key] = "[REDACTED]"
      } else {
        sanitized[key] = redactSensitiveData(value, depth + 1)
      }
    }
    return sanitized
  }

  return data
}

const pathnameOf = (request: Request) =>
  redactSensitivePathname(new URL(request.url).pathname)

export const contextFor = (request: Request): ApiRequestContext => {
  const existing = requestContexts.get(request)
  if (existing) {
    return existing
  }

  const context: ApiRequestContext = {
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
  set: { status?: number | string },
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
  typeof code === "string" && safeErrorCodes[code] ? code : "UNKNOWN"

const extractCaller = (auth?: ResolvedAuth | null, request?: Request) => {
  const clientIp =
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request?.headers.get("cf-connecting-ip")?.trim() ??
    null
  const userAgent = request?.headers.get("user-agent") ?? null

  if (!auth) {
    return {
      type: "anonymous",
      ip: clientIp,
      userAgent,
    }
  }

  if (auth.type === "workos") {
    return {
      type: "workos",
      userId: auth.userId,
      email: auth.email,
      organizationId: auth.organizationId,
      orgRole: auth.orgRole,
      platformRole: auth.platformRole,
      source: auth.source,
      ip: clientIp,
      userAgent,
    }
  }

  if (auth.type === "platform") {
    return {
      type: "platform",
      keyId: auth.keyId,
      keyName: auth.keyName,
      organizationId: auth.organizationId,
      environment: auth.environment,
      source: auth.source,
      ip: clientIp,
      userAgent,
    }
  }

  return {
    type: "unknown",
    ip: clientIp,
    userAgent,
  }
}

const emitCompletion = (
  request: Request,
  context: ApiRequestContext,
  set: { status?: number | string },
  response: unknown
) => {
  const statusCode = statusCodeOf(set, response, 200)
  const caller = extractCaller(context.auth, request)
  const pathname = pathnameOf(request)
  const durationMs = durationSince(context.startedAt)

  const logPayload: Record<string, unknown> = {
    event: "api.request.completed",
    requestId: context.requestId,
    method: request.method,
    pathname,
    statusCode,
    durationMs,
    caller,
  }

  if (context.body !== undefined && context.body !== null) {
    logPayload.body = redactSensitiveData(context.body)
  }

  logger.info(logPayload, `API ${request.method} ${pathname} ${statusCode}`)
}

const emitError = (
  request: Request,
  context: ApiRequestContext,
  code: unknown
) => {
  const caller = extractCaller(context.auth, request)
  const pathname = pathnameOf(request)
  const durationMs = durationSince(context.startedAt)
  const errorCode = errorCodeOf(code)

  const logPayload: Record<string, unknown> = {
    event: "api.request.error",
    requestId: context.requestId,
    method: request.method,
    pathname,
    statusCode: 500,
    durationMs,
    errorCode,
    caller,
  }

  if (context.body !== undefined && context.body !== null) {
    logPayload.body = redactSensitiveData(context.body)
  }

  logger.error(
    logPayload,
    `API Error ${request.method} ${pathname}: ${errorCode}`
  )
}

export const createApiLoggingPlugin = () =>
  new Elysia({ name: "api-logging" })
    .onRequest(async ({ request }) => {
      const context = contextFor(request)
      try {
        context.auth = await resolveAuthContext(request)
      } catch {
        // Ignored — auth fallback
      }
    })
    .onTransform(({ request, body }) => {
      const context = contextFor(request)
      if (body !== undefined) {
        context.body = body
      }
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
