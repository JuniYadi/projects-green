import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Verifies the HMAC-SHA256 signature from Meta.
 * @param rawBody - The raw request body as a string.
 * @param signature - The X-Hub-Signature-256 header value (sha256=...).
 */
export function verifySignature(rawBody: string, signature: string): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    console.error("META_APP_SECRET is not set")
    return false
  }

  if (!signature || !signature.startsWith("sha256=")) {
    return false
  }

  const signatureHash = signature.replace("sha256=", "")
  const expectedHash = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")

  try {
    return timingSafeEqual(
      Buffer.from(signatureHash, "hex"),
      Buffer.from(expectedHash, "hex")
    )
  } catch (err) {
    return false
  }
}
