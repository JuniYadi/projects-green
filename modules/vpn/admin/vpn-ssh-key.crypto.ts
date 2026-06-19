import crypto from "node:crypto"
import * as sshpk from "sshpk"

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
 * Parse an SSH private key in any supported format (OpenSSH, PKCS#8 PEM,
 * RSA/EC/DSA traditional PEM) and return the DER-encoded SPKI public key
 * bytes plus the algorithm name.
 *
 * Throws VpnSshKeyError for malformed, unsupported, or encrypted keys.
 */
export function parseSshPrivateKey(privateKey: string): {
  publicKeyDer: Buffer
  algorithm: string
} {
  let parsed: sshpk.PrivateKey
  try {
    parsed = sshpk.parsePrivateKey(privateKey, "auto")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (
      message.toLowerCase().includes("encrypted") ||
      message.toLowerCase().includes("password")
    ) {
      throw new VpnSshKeyError(
        "Encrypted SSH private keys are not supported. Provide an unencrypted private key."
      )
    }
    throw new VpnSshKeyError(
      "Unsupported or malformed SSH private key. Supported formats: " +
        "OpenSSH private key, PKCS#8 PEM, and RSA PEM."
    )
  }

  // Export public key as PEM, then import via Node crypto for canonical DER SPKI
  const pubPem = parsed.toPublic().toString("pem")
  try {
    const publicKey = crypto.createPublicKey(pubPem)
    const publicKeyDer = publicKey.export({
      format: "der",
      type: "spki",
    }) as Buffer
    return { publicKeyDer, algorithm: parsed.type }
  } catch {
    throw new VpnSshKeyError(
      "Could not derive a standard public key from the provided private key."
    )
  }
}

/**
 * Compute a deterministic SHA256 fingerprint from an SSH private key by
 * deriving the public key and hashing its DER SPKI encoding.
 * Format: "SHA256:<base64-no-padding>" — stable for de-dupe and display.
 * Throws VpnSshKeyError if the key cannot be parsed.
 */
export function computeSshKeyFingerprint(privateKey: string): string {
  const { publicKeyDer } = parseSshPrivateKey(privateKey)
  const digest = crypto
    .createHash("sha256")
    .update(publicKeyDer)
    .digest("base64")
    .replace(/=+$/, "")

  return `SHA256:${digest}`
}

/** Reset cached key. Used in tests to isolate env changes. */
export function resetVpnSshCrypto(): void {
  cachedKey = null
}
