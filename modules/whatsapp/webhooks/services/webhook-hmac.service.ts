/**
 * WhatsApp Webhook HMAC Signature Verification
 *
 * Verifies X-Hub-Signature-256 header from Meta/WhatsApp Cloud API.
 * Uses constant-time comparison to prevent timing attacks.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

const SIGNATURE_PREFIX = "sha256="

/**
 * Verify HMAC-SHA256 signature from WhatsApp webhook.
 *
 * @param appSecret - The app secret for this WhatsApp device
 * @param rawBody - Raw request body as string
 * @param signatureHeader - The X-Hub-Signature-256 header value
 * @returns true if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  appSecret: string,
  rawBody: string,
  signatureHeader: string | null | undefined
): boolean {
  if (!signatureHeader || !appSecret) {
    return false
  }

  if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false
  }

  const receivedHash = signatureHeader.slice(SIGNATURE_PREFIX.length)
  if (receivedHash.length !== 64) {
    return false
  }

  const expectedHash = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex")

  const receivedBuffer = Buffer.from(receivedHash, "hex")
  const expectedBuffer = Buffer.from(expectedHash, "hex")

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer)
}
