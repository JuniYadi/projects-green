const DEFAULT_AI_BOT_TIMEOUT_MS = 60000

/**
 * Resolves the shared AI bot inference timeout (milliseconds) used by the
 * WhatsApp, widget and simulator model calls, from `AI_BOT_TIMEOUT_MS`.
 * Unset, non-numeric, zero or negative values fall back to the default
 * rather than disabling the timeout.
 */
export function getAiBotTimeoutMs(): number {
  const raw = process.env.AI_BOT_TIMEOUT_MS
  if (!raw) {
    return DEFAULT_AI_BOT_TIMEOUT_MS
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_AI_BOT_TIMEOUT_MS
  }

  return parsed
}

/**
 * Detects whether an error thrown by an AI SDK call represents a timeout
 * (or an aborted call), as opposed to a generic provider/model failure.
 */
export function isAiBotTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  return error.name === "TimeoutError" || error.name === "AbortError"
}
