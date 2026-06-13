import crypto from "node:crypto"

import {
  encrypt,
  decrypt,
  parseEncryptedField,
  serializeEncryptedField,
} from "@/lib/encryption"

export class VpnSshKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "VpnSshKeyError"
  }
}

let cachedKey: Buffer | null = null

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new VpnSshKeyError("ENCRYPTION_KEY environment variable is not set")
  }

  const key = Buffer.from(raw, "hex")
  if (key.length !== 32) {
    throw new VpnSshKeyError(
      "ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters) for AES-256-GCM"
    )
  }

  cachedKey = key
  return key
}

/** Encrypt an SSH private key for storage (AES-256-GCM). */
export function encryptSshPrivateKey(plaintext: string): string {
  return serializeEncryptedField(encrypt(plaintext, getEncryptionKey()))
}

/** Decrypt an SSH private key previously stored with encryptSshPrivateKey. */
export function decryptSshPrivateKey(encryptedValue: string): string {
  const data = parseEncryptedField(encryptedValue)
  if (!data) {
    throw new VpnSshKeyError("Invalid encrypted SSH key format")
  }
  return decrypt(data, getEncryptionKey())
}

/**
 * Compute a deterministic SHA256 fingerprint from an SSH private key by
 * deriving the public key (via node:crypto) and hashing its DER encoding.
 * Format: "SHA256:<base64-no-padding>" — stable for de-dupe and display.
 * Throws VpnSshKeyError if the key cannot be parsed.
 */
export function computeSshKeyFingerprint(privateKeyPem: string): string {
  let publicDer: Buffer
  try {
    const privateKey = crypto.createPrivateKey(privateKeyPem)
    const publicKey = crypto.createPublicKey(privateKey)
    publicDer = publicKey.export({ format: "der", type: "spki" }) as Buffer
  } catch {
    throw new VpnSshKeyError(
      "Could not parse the SSH private key. Provide a valid PEM/OpenSSH private key."
    )
  }

  const digest = crypto
    .createHash("sha256")
    .update(publicDer)
    .digest("base64")
    .replace(/=+$/, "")

  return `SHA256:${digest}`
}

/** Reset cached key. Used in tests to isolate env changes. */
export function resetVpnSshCrypto(): void {
  cachedKey = null
}
