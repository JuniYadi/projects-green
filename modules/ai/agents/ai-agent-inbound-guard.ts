export type InboundGuardBlockReason =
  "MAX_CHAR_EXCEEDED" | "BLOCKED_WORD_TRIGGERED" | "DAILY_LIMIT_REACHED"

export type InboundGuardParams = {
  text: string
  maxCharLength?: number | null
  enableProfanityFilter?: boolean | null
  customBlockedWords?: string[] | null
  fallbackMessage?: string | null
  dailyUserLimit?: number | null
  /**
   * The session's message count *before* this inbound message. Omit it to
   * skip the daily-limit branch entirely — used by a pre-session checkpoint
   * (e.g. WhatsApp's char-limit/blocked-word check, which runs before any
   * session row exists) that has no count to check yet.
   */
  currentMessageCount?: number
}

export type InboundGuardResult =
  | { ok: true }
  | {
      ok: false
      reason: InboundGuardBlockReason
      replyMessage: string | null
    }

const DEFAULT_MAX_CHAR_LENGTH = 800
const DEFAULT_DAILY_USER_LIMIT = 30

/**
 * Pure inbound-message safety check shared by WhatsApp and the widget:
 * character limit, then blocked words, then the daily message limit,
 * checked in that order. No I/O — callers resolve the agent/binding fields
 * and the current message count themselves.
 *
 * Returns `{ ok: false, reason, replyMessage }` where `replyMessage` is
 * always `null` for `MAX_CHAR_EXCEEDED` (no reply is ever sent for it) and
 * `fallbackMessage || null` for the other two reasons, so an unset
 * `fallbackMessage` never invents text for the caller to send.
 */
export function checkInboundAgentGuardrails(
  params: InboundGuardParams
): InboundGuardResult {
  const maxChar = params.maxCharLength || DEFAULT_MAX_CHAR_LENGTH
  if (params.text.length > maxChar) {
    return { ok: false, reason: "MAX_CHAR_EXCEEDED", replyMessage: null }
  }

  if (params.enableProfanityFilter && params.customBlockedWords?.length) {
    const lowerText = params.text.toLowerCase()
    const isBlocked = params.customBlockedWords.some((word) =>
      lowerText.includes(word.toLowerCase().trim())
    )
    if (isBlocked) {
      return {
        ok: false,
        reason: "BLOCKED_WORD_TRIGGERED",
        replyMessage: params.fallbackMessage || null,
      }
    }
  }

  if (params.currentMessageCount !== undefined) {
    const dailyLimit = params.dailyUserLimit ?? DEFAULT_DAILY_USER_LIMIT
    if (params.currentMessageCount >= dailyLimit) {
      return {
        ok: false,
        reason: "DAILY_LIMIT_REACHED",
        replyMessage: params.fallbackMessage || null,
      }
    }
  }

  return { ok: true }
}
