import type { NextRequest } from "next/server"

/**
 * Resolves the public, proxy-aware origin of a request.
 * Checks in order:
 * 1. APP_URL or NEXT_PUBLIC_APP_URL environment variables
 * 2. x-forwarded-proto + (x-forwarded-host / host) headers
 * 3. request.url origin as fallback
 */
export const getRequestOrigin = (
  request?: Request | NextRequest | { headers: Headers; url?: string } | string
): string => {
  if (typeof request === "string") {
    try {
      const url = new URL(request)
      if (
        url.hostname !== "0.0.0.0" &&
        url.hostname !== "localhost" &&
        url.hostname !== "127.0.0.1"
      ) {
        return url.origin
      }
    } catch {
      // ignore
    }
  }

  if (typeof request === "object" && request !== null && "headers" in request) {
    const headers = request.headers
    const forwardedProto = headers.get("x-forwarded-protocol")
    const forwardedHost = headers.get("x-forwarded-host")

    if (forwardedHost) {
      const proto = forwardedProto || "https"
      return `${proto}://${forwardedHost}`
    }

    if (request.url) {
      try {
        const url = new URL(request.url)
        // If request.url has a standard host (e.g. from client/test, not internal 0.0.0.0 bind)
        if (url.hostname !== "0.0.0.0") {
          const proto = forwardedProto || url.protocol.replace(":", "")
          const host = headers.get("host") || url.host
          return `${proto}://${host}`
        }
      } catch {
        // ignore
      }
    }
  }

  const envUrl =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (envUrl) {
    try {
      return new URL(envUrl).origin
    } catch {
      // ignore
    }
  }

  return "http://localhost:3300"
}

/**
 * Builds an absolute URL using the proxy-safe public request origin.
 */
export const getRequestUrl = (
  pathnameAndSearch: string,
  request?: Request | NextRequest | { headers: Headers; url?: string } | string
): URL => {
  const origin = getRequestOrigin(request)
  return new URL(pathnameAndSearch, origin)
}

/**
 * Returns true if the request was made over HTTPS (directly or via reverse proxy).
 */
export const isSecureRequest = (
  request?: Request | NextRequest | { headers?: Headers; url?: string } | string
): boolean => {
  if (typeof request === "string") {
    try {
      return new URL(request).protocol === "https:"
    } catch {
      return false
    }
  }

  if (request && "headers" in request && request.headers) {
    const forwardedProto =
      request.headers.get("x-forwarded-proto") ||
      request.headers.get("x-forwarded-protocol")
    if (forwardedProto) {
      return forwardedProto === "https"
    }
  }

  const origin = getRequestOrigin(
    request as Request | NextRequest | { headers: Headers; url?: string }
  )
  return origin.startsWith("https:")
}
