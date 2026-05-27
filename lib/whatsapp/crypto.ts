/**
 * WhatsApp / Meta Cloud — Cryptographic utilities.
 * Ported from krmpesan-api/src/lib/app-key-crypto.ts.
 *
 * Uses the Web Crypto API (subtle) + Buffer for universal Bun/Node compatibility.
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto"

// ─── API Key hashing (PBKDF2-SHA256) ─────────────────────────────────────────

const PBKDF2_ITERATIONS = 600_000

/**
 * Hash a raw API key with PBKDF2-SHA256.
 * Used to compare a presented key against the stored keyHash.
 */
export const hashApiKey = async (
  rawKey: string,
  salt: string
): Promise<string> => {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(rawKey),
    "PBKDF2",
    false,
    ["deriveBits"]
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  )
  return Buffer.from(bits).toString("base64")
}

// ─── WhatsApp token encryption (AES-256-GCM) ─────────────────────────────────

const APP_KEY_ENCRYPTION_VERSION = "v1"
const APP_KEY_IV_LENGTH = 12
const APP_KEY_LENGTH = 32

type AppKeyCryptoErrorCode =
  | "APP_KEY_MISSING"
  | "APP_KEY_INVALID"
  | "APP_KEY_DECRYPTION_INVALID_PAYLOAD"
  | "APP_KEY_DECRYPTION_UNSUPPORTED_VERSION"

export class AppKeyCryptoError extends Error {
  code: AppKeyCryptoErrorCode

  constructor(code: AppKeyCryptoErrorCode, message: string) {
    super(message)
    this.name = "AppKeyCryptoError"
    this.code = code
  }
}

let cachedAppKeyRaw: string | null = null
let cachedKeyBuffer: Buffer | null = null

function readAppKey(): string {
  const appKey = process.env.APP_KEY?.trim()
  if (!appKey) {
    throw new AppKeyCryptoError(
      "APP_KEY_MISSING",
      "APP_KEY is required and must be a base64/base64url-encoded 32-byte key"
    )
  }
  return appKey
}

function getKeyBuffer(): Buffer {
  const appKey = readAppKey()
  if (cachedKeyBuffer && cachedAppKeyRaw === appKey) return cachedKeyBuffer

  // Try base64url first, then base64
  let keyBuffer: Buffer
  try {
    keyBuffer = Buffer.from(appKey.replace(/-/g, "+").replace(/_/g, "/"), "base64url")
  } catch {
    try {
      keyBuffer = Buffer.from(appKey, "base64")
    } catch {
      throw new AppKeyCryptoError(
        "APP_KEY_INVALID",
        "APP_KEY must be valid base64/base64url-encoded key material"
      )
    }
  }

  if (keyBuffer.byteLength !== APP_KEY_LENGTH) {
    throw new AppKeyCryptoError(
      "APP_KEY_INVALID",
      `APP_KEY must decode to exactly ${APP_KEY_LENGTH} bytes for AES-256-GCM`
    )
  }

  cachedAppKeyRaw = appKey
  cachedKeyBuffer = keyBuffer
  return keyBuffer
}

function encodeBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url").replace(/=+$/, "")
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer
}

export function assertAppKeyCryptoConfigured(): void {
  getKeyBuffer() // throws if invalid
}

/**
 * Encrypt a WhatsApp token (or any sensitive string) with the APP_KEY.
 * Returns format: "v1.<iv>.<ciphertext>" (base64url).
 */
export async function encryptWithAppKey(plaintext: string): Promise<string> {
  const keyBuffer = getKeyBuffer()
  const iv = randomBytes(APP_KEY_IV_LENGTH)
  const plaintextBuffer = Buffer.from(plaintext, "utf8")

  // Use Web Crypto for AES-GCM (available in Bun without node:crypto)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBuffer),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  )

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    cryptoKey,
    toArrayBuffer(plaintextBuffer)
  )

  const cipherBuffer = Buffer.from(encrypted)
  return `${APP_KEY_ENCRYPTION_VERSION}.${encodeBase64Url(iv)}.${encodeBase64Url(cipherBuffer)}`
}

/**
 * Decrypt a WhatsApp token (or any sensitive string) encrypted with APP_KEY.
 * Accepts format "v1.<iv>.<ciphertext>" (base64url).
 */
export async function decryptWithAppKey(encryptedValue: string): Promise<string> {
  const parts = encryptedValue.split(".")
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new AppKeyCryptoError(
      "APP_KEY_DECRYPTION_INVALID_PAYLOAD",
      "Encrypted payload format is invalid"
    )
  }

  const [version, ivRaw, cipherRaw] = parts
  if (version !== APP_KEY_ENCRYPTION_VERSION) {
    throw new AppKeyCryptoError(
      "APP_KEY_DECRYPTION_UNSUPPORTED_VERSION",
      `Encrypted payload version '${version}' is not supported`
    )
  }

  let iv: Buffer
  let cipherBuffer: Buffer
  try {
    // Use base64url decoding
    const normalizedIv = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const normalizedCipher = parts[2].replace(/-/g, "+").replace(/_/g, "/")
    // Pad to valid base64 length
    const padIv = normalizedIv + "=".repeat((4 - (normalizedIv.length % 4)) % 4)
    const padCipher = normalizedCipher + "=".repeat((4 - (normalizedCipher.length % 4)) % 4)
    iv = Buffer.from(padIv, "base64")
    cipherBuffer = Buffer.from(padCipher, "base64")
  } catch {
    throw new AppKeyCryptoError(
      "APP_KEY_DECRYPTION_INVALID_PAYLOAD",
      "Encrypted payload encoding is invalid"
    )
  }

  if (iv.byteLength !== APP_KEY_IV_LENGTH) {
    throw new AppKeyCryptoError(
      "APP_KEY_DECRYPTION_INVALID_PAYLOAD",
      "Encrypted payload IV length is invalid"
    )
  }

  try {
    const keyBuffer = getKeyBuffer()
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(keyBuffer),
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    )

    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      cryptoKey,
      toArrayBuffer(cipherBuffer)
    )
    return new TextDecoder().decode(plainBuffer)
  } catch {
    throw new AppKeyCryptoError(
      "APP_KEY_DECRYPTION_INVALID_PAYLOAD",
      "Encrypted payload authentication failed"
    )
  }
}

/**
 * Generate a random API key (raw) and its corresponding hash.
 * Returns the raw key (shown once) and the hash (stored in DB).
 */
export async function generateRawApiKey(prefix = "live_"): Promise<{ raw: string; hash: string }> {
  const bytes = randomBytes(32)
  const raw = prefix + bytes.toString("base64url")
  const hash = await hashApiKey(raw.slice(prefix.length), process.env.API_KEY_HASH_SALT ?? "dev-salt-change-me")
  return { raw, hash }
}

/**
 * Encrypt a WhatsApp Business token stored in DB.
 * Wraps encryptWithAppKey with error normalization.
 */
export async function encryptWhatsAppToken(token: string): Promise<string> {
  return encryptWithAppKey(token)
}

/**
 * Decrypt a WhatsApp Business token retrieved from DB.
 * Wraps decryptWithAppKey with error normalization.
 */
export async function decryptWhatsAppToken(encryptedToken: string): Promise<string> {
  return decryptWithAppKey(encryptedToken)
}