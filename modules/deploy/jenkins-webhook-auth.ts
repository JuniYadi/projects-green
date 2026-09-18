import crypto from "node:crypto"

/**
 * Creates an HMAC-SHA256 signature for Jenkins webhook payloads.
 * Expected format: HMAC-SHA256(timestamp + "." + rawBody, webhookToken)
 */
export function createJenkinsHmacSignature(
  rawBody: string,
  webhookToken: string,
  timestamp: string | number
): string {
  return crypto
    .createHmac("sha256", webhookToken)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")
}

/**
 * Helper to generate standard Jenkins webhook authentication headers.
 */
export function createJenkinsWebhookHeaders(
  rawBody: string,
  webhookToken: string,
  options?: {
    timestamp?: string | number
    prefixSha256?: boolean
  }
): Record<string, string> {
  const timestamp =
    options?.timestamp !== undefined
      ? String(options.timestamp)
      : Math.floor(Date.now() / 1000).toString()

  const signature = createJenkinsHmacSignature(rawBody, webhookToken, timestamp)

  return {
    "x-jenkins-timestamp": timestamp,
    "x-jenkins-signature-256": options?.prefixSha256
      ? `sha256=${signature}`
      : signature,
  }
}

/**
 * Verifies the HMAC-SHA256 signature of an incoming Jenkins webhook request.
 *
 * Reads `x-jenkins-signature-256` (or `x-jenkins-signature`) and `x-jenkins-timestamp`.
 * Validates that |T_server - T_header| <= 60 seconds (replay defense).
 * Compares timing-safe against HMAC-SHA256(timestamp + "." + rawBody, webhookToken).
 */
export function verifyJenkinsHmacSignature(
  rawBody: string,
  headers: Headers | Record<string, string | undefined>,
  webhookToken: string
): boolean {
  if (!webhookToken || typeof webhookToken !== "string") {
    return false
  }

  if (typeof rawBody !== "string") {
    return false
  }

  if (!headers) {
    return false
  }

  let signature: string | undefined
  let timestamp: string | undefined

  if (headers instanceof Headers) {
    signature =
      headers.get("x-jenkins-signature-256") ??
      headers.get("x-jenkins-signature") ??
      undefined
    timestamp = headers.get("x-jenkins-timestamp") ?? undefined
  } else if (typeof headers === "object") {
    for (const [key, value] of Object.entries(headers)) {
      const lower = key.toLowerCase()
      if (
        (lower === "x-jenkins-signature-256" ||
          lower === "x-jenkins-signature") &&
        typeof value === "string" &&
        !signature
      ) {
        signature = value
      }
      if (lower === "x-jenkins-timestamp" && typeof value === "string") {
        timestamp = value
      }
    }
  }

  if (!signature || !timestamp) {
    return false
  }

  const cleanSignature = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature

  // Timestamp validation: |T_server - T_header| <= 60 seconds (replay defense)
  const headerTime = Number(timestamp)
  if (!Number.isFinite(headerTime) || headerTime <= 0) {
    return false
  }

  const nowMs = Date.now()
  // Support timestamps in seconds (typical) or milliseconds
  const headerTimeMs = headerTime > 1e11 ? headerTime : headerTime * 1000
  const diffSec = Math.abs(nowMs - headerTimeMs) / 1000

  if (diffSec > 60) {
    return false
  }

  try {
    const expected = createJenkinsHmacSignature(
      rawBody,
      webhookToken,
      timestamp
    )

    if (cleanSignature.length !== expected.length) {
      return false
    }

    const sigBuf = Buffer.from(cleanSignature, "hex")
    const expBuf = Buffer.from(expected, "hex")

    if (sigBuf.length !== expBuf.length) {
      return false
    }

    return crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}
