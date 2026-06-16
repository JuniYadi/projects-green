/**
 * In-memory sliding-window rate limiter.
 *
 * Tracks timestamps per key in a Map<string, number[]>.
 * Periodically purges stale entries to prevent memory leaks.
 */

export type RateLimitConfig = { windowMs: number; max: number }
export type RateLimitResult = { allowed: boolean; remaining: number; resetMs: number }

/**
 * Create a rate limiter with the given window and max count.
 * Returns a function that, given a key, returns the rate-limit result.
 */
export function createRateLimiter(config: RateLimitConfig): (key: string) => RateLimitResult {
  const { windowMs, max } = config
  const store = new Map<string, number[]>()
  let cleanupCounter = 0

  return (key: string): RateLimitResult => {
    const now = Date.now()
    const windowStart = now - windowMs

    let timestamps = store.get(key)

    // Remove entries outside the sliding window for this key
    if (timestamps) {
      timestamps = timestamps.filter((t) => t > windowStart)
      if (timestamps.length === 0) {
        store.delete(key)
      } else {
        store.set(key, timestamps)
      }
    }

    // Periodic full cleanup to prevent memory leaks (every 100 calls)
    cleanupCounter++
    if (cleanupCounter % 100 === 0) {
      for (const [k, ts] of store) {
        const filtered = ts.filter((t) => t > windowStart)
        if (filtered.length === 0) {
          store.delete(k)
        } else {
          store.set(k, filtered)
        }
      }
    }

    // First request for this key
    if (!timestamps || timestamps.length === 0) {
      timestamps = [now]
      store.set(key, timestamps)
      return {
        allowed: true,
        remaining: max - 1,
        resetMs: now + windowMs,
      }
    }

    // At capacity — reject
    if (timestamps.length >= max) {
      const oldest = timestamps[0]!
      const resetMs = oldest + windowMs
      return {
        allowed: false,
        remaining: 0,
        resetMs,
      }
    }

    // Within limits — record and allow
    timestamps.push(now)
    store.set(key, timestamps)

    const oldest = timestamps[0]!
    const resetMs = oldest + windowMs

    return {
      allowed: true,
      remaining: max - timestamps.length,
      resetMs,
    }
  }
}

/**
 * Extract the client IP address from a Request object.
 * Checks x-forwarded-for first, then x-real-ip, falls back to "unknown".
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  )
}

/**
 * Build a 429 rate-limit error response body.
 * The caller is responsible for setting `set.status = 429` and the
 * rate-limit response headers on their own `set` object.
 */
export function buildRateLimitResponse(result: RateLimitResult): {
  error: { code: string; message: string; details: Record<string, unknown> }
} {
  const retryAfterSeconds = Math.ceil(
    (result.resetMs - Date.now()) / 1000
  )
  return {
    error: {
      code: "RATE_LIMITED" as const,
      message: "Too many requests. Please try again later.",
      details: {
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      },
    },
  }
}

/**
 * Rate-limit response headers to set on the response.
 */
export function rateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  const retryAfterSeconds = Math.ceil(
    (result.resetMs - Date.now()) / 1000
  )
  return {
    "Retry-After": String(Math.max(1, retryAfterSeconds)),
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": String(result.resetMs),
  }
}
