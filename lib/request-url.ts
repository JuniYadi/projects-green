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
  const envUrl =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (envUrl) {
    try {
      return new URL(envUrl).origin
    } catch {
      // Fall through to header/request inspection
    }
  }

  if (typeof request === "object" && request !== null && "headers" in request) {
    const headers = request.headers
    const forwardedProto =
      headers.get("x-forwarded-proto") || headers.get("x-forwarded-protocol")
    const forwardedHost = headers.get("x-forwarded-host") || headers.get("host")

    if (forwardedHost) {
      const proto = forwardedProto || "https"
      return `${proto}://${forwardedHost}`
    }

    if (request.url) {
      try {
        const url = new URL(request.url)
        if (url.hostname !== "0.0.0.0") {
          const proto = forwardedProto || url.protocol.replace(":", "")
          const host = url.host
          return `${proto}://${host}`
        }
      } catch {
        // ignore
      }
    }
  }

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

  if (request && typeof request === "object") {
    const headers = "headers" in request ? request.headers : undefined
    if (headers && typeof headers.get === "function") {
      const forwardedProto =
        headers.get("x-forwarded-proto") || headers.get("x-forwarded-protocol")
      if (forwardedProto) {
        return forwardedProto === "https"
      }
    }
  }

  const origin = getRequestOrigin(
    request as Request | NextRequest | { headers: Headers; url?: string }
  )
  return origin.startsWith("https:")
}
