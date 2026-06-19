import { randomBytes } from "crypto"

import { VoucherCollisionRetryExhaustedError } from "./vouchers.errors"

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const DEFAULT_RANDOM_LENGTH = 8
const PREFIX_RANDOM_LENGTH = 6
const MAX_RETRIES = 5

/**
 * Generate a cryptographically secure random alphanumeric string.
 */
function randomAlphanumeric(length: number): string {
  const bytes = randomBytes(length)
  let result = ""
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length]
  }
  return result
}

/**
 * Generate a voucher code.
 *
 * @param prefix - Optional uppercase prefix (e.g. "PFN" → "PFN-ABC123")
 * @param randomLength - Length of the random segment (default 8, or 6 with prefix)
 * @returns Uppercase alphanumeric code with optional prefix segment
 *
 * @throws {Error} If prefix contains characters other than A-Z
 */
export function generateVoucherCode(
  prefix?: string,
  randomLength?: number
): string {
  const normalizedPrefix = prefix?.toUpperCase().trim() ?? ""
  const len =
    randomLength ??
    (normalizedPrefix ? PREFIX_RANDOM_LENGTH : DEFAULT_RANDOM_LENGTH)
  const random = randomAlphanumeric(len)

  if (normalizedPrefix) {
    if (!/^[A-Z]+$/.test(normalizedPrefix)) {
      throw new Error("Prefix must contain only uppercase letters A-Z")
    }
    return `${normalizedPrefix}-${random}`
  }

  return random
}

/**
 * Retry wrapper for collision-safe code generation.
 * Calls `createFn` with a generated code and retries if it returns false.
 * Throws after MAX_RETRIES failures.
 */
export async function generateUniqueVoucherCode(
  createFn: (code: string) => Promise<boolean>,
  prefix?: string,
  randomLength?: number
): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateVoucherCode(prefix, randomLength)
    const success = await createFn(code)
    if (success) return code
  }
  throw new VoucherCollisionRetryExhaustedError()
}
