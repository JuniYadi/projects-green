import {
  encrypt,
  decrypt,
  parseEncryptedField,
  serializeEncryptedField,
} from "@/lib/encryption"

class VpnCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VpnCryptoError"
  }
}

let cachedKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new VpnCryptoError("ENCRYPTION_KEY environment variable is not set")
  }

  const key = Buffer.from(raw, "hex")
  if (key.length !== 32) {
    throw new VpnCryptoError(
      "ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters) for AES-256-GCM",
    )
  }

  cachedKey = key
  return key
}

/**
 * Encrypt a VPN config (OVPN) string using ENCRYPTION_KEY.
 * Returns a serialized JSON string containing the encrypted payload.
 */
export function encryptVpnConfig(plaintext: string): string {
  const encrypted = encrypt(plaintext, getEncryptionKey())
  return serializeEncryptedField(encrypted)
}

/**
 * Decrypt a VPN config (OVPN) string previously encrypted with encryptVpnConfig.
 */
export function decryptVpnConfig(encryptedValue: string): string {
  const data = parseEncryptedField(encryptedValue)
  if (!data) {
    throw new VpnCryptoError("Invalid encrypted config format")
  }
  return decrypt(data, getEncryptionKey())
}

/**
 * Encrypt a proxy password for at-rest storage. Unlike a one-way hash this is
 * reversible so the customer can view the password on demand (Story 17).
 */
export function encryptProxyPassword(plaintext: string): string {
  return serializeEncryptedField(encrypt(plaintext, getEncryptionKey()))
}

/** Decrypt a proxy password previously encrypted with encryptProxyPassword. */
export function decryptProxyPassword(encryptedValue: string): string {
  const data = parseEncryptedField(encryptedValue)
  if (!data) {
    throw new VpnCryptoError("Invalid encrypted password format")
  }
  return decrypt(data, getEncryptionKey())
}

/**
 * Clear the cached encryption key. Used in tests to isolate env changes.
 */
export function resetVpnCrypto(): void {
  cachedKey = null
}
