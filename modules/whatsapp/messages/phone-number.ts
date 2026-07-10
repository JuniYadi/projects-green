/**
 * WhatsApp Messages — Phone Number Utilities
 *
 * Shared E.164 regex and Indonesian phone number normalizer.
 */

// E.164: + followed by country code (1-3 digits) and subscriber number, 1-15 digits total
export const e164PhoneRegex = /^\+[1-9]\d{1,14}$/

/**
 * Normalize an Indonesian local phone number to E.164 format.
 * - `08xxxxxxxxx` → `+628xxxxxxxxx`
 * - `628xxxxxxxxx` → `+628xxxxxxxxx`
 * - Already E.164 (`+628xxxxxxxxx`) → unchanged
 * - Other international numbers preserved if valid E.164 after stripping formatting
 * - Returns `null` when input cannot be normalized to valid E.164
 */
export function normalizeIndonesianPhoneNumber(input: string): string | null {
  const trimmed = input.trim()
  const cleaned = trimmed.replace(/[\s\-()]/g, "")
  const digits = cleaned.replace(/\D/g, "")

  if (!digits) return null

  let candidate: string

  if (digits.startsWith("08")) {
    candidate = "+62" + digits.slice(1)
  } else if (digits.startsWith("62")) {
    candidate = "+" + digits
  } else {
    candidate = "+" + digits
  }

  return e164PhoneRegex.test(candidate) ? candidate : null
}
