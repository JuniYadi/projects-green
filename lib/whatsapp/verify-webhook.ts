import type { VerifyWebhookInput, VerifyWebhookResult } from "./contracts"

export function verifyWebhookUseCase(input: VerifyWebhookInput): VerifyWebhookResult {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  const isValid =
    input.mode === "subscribe" &&
    typeof verifyToken === "string" &&
    verifyToken.length > 0 &&
    input.token === verifyToken &&
    typeof input.challenge === "string"

  if (!isValid) {
    return { ok: false }
  }

  return {
    ok: true,
    challenge: input.challenge,
  }
}
