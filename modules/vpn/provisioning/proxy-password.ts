import crypto from "node:crypto"

/**
 * Hash a proxy password for at-rest storage. Story 14 requires the proxy
 * password to be stored hashed (not plaintext). We use scrypt with a random
 * salt, encoded as `scrypt$<saltHex>$<hashHex>`.
 */
export function hashProxyPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const derived = crypto.scryptSync(password, salt, 32)
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`
}

/** Verify a proxy password against a stored hash produced by hashProxyPassword. */
export function verifyProxyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false
  const salt = Buffer.from(parts[1], "hex")
  const expected = Buffer.from(parts[2], "hex")
  const derived = crypto.scryptSync(password, salt, expected.length)
  return crypto.timingSafeEqual(derived, expected)
}
