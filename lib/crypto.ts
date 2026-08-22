import crypto from "node:crypto"

const HKDF_INFO_TENANT_PATH = "storage:tenant-path"

let cachedStorageKey: Buffer | null = null
let cachedAppKeySource: string | null = null

function getMasterKey(): Buffer {
  const secret =
    process.env.APP_KEY || process.env.ENCRYPTION_KEY || process.env.APP_SECRET
  if (!secret) {
    throw new Error(
      "Missing APP_KEY, ENCRYPTION_KEY, or APP_SECRET environment variable"
    )
  }

  const trimmed = secret.trim()
  if (trimmed.startsWith("base64:")) {
    const raw = Buffer.from(trimmed.slice(7), "base64")
    if (raw.length === 32) return raw
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex")
  }

  const buf = Buffer.from(trimmed, "utf8")
  if (buf.length === 32) return buf

  return crypto.createHash("sha256").update(buf).digest()
}

/**
 * Derive 32-byte storage tenant path subkey from APP_KEY via HKDF-SHA256
 */
export function getStorageTenantSubkey(): Buffer {
  const rawSource =
    process.env.APP_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.APP_SECRET ||
    ""
  if (cachedStorageKey && cachedAppKeySource === rawSource) {
    return cachedStorageKey
  }

  const master = getMasterKey()
  const derived = Buffer.from(
    crypto.hkdfSync(
      "sha256",
      master,
      Buffer.alloc(0), // empty salt
      Buffer.from(HKDF_INFO_TENANT_PATH, "utf8"),
      32
    )
  )

  cachedStorageKey = derived
  cachedAppKeySource = rawSource
  return derived
}

/**
 * Deterministically derives an IV for the given organizationId and key
 */
function getDeterministicTenantIv(
  organizationId: string,
  subkey: Buffer
): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      "sha256",
      subkey,
      Buffer.alloc(0),
      Buffer.from(`storage:iv:${organizationId}`, "utf8"),
      12
    )
  )
}

/**
 * Encrypts an organizationId into a deterministic compact flat hex string.
 * Format: IV (24 hex = 12 bytes) + AuthTag (32 hex = 16 bytes) + Ciphertext (hex)
 * Deterministic: encrypt(orgId) menghasilkan output yang sama secara konsisten.
 */
export function encryptTenantStoragePath(organizationId: string): string {
  if (!organizationId || typeof organizationId !== "string") {
    throw new Error("Invalid organizationId for tenant path encryption")
  }

  const key = getStorageTenantSubkey()
  const iv = getDeterministicTenantIv(organizationId, key)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(organizationId, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return iv.toString("hex") + tag.toString("hex") + ciphertext.toString("hex")
}

/**
 * Decrypts a compact flat hex string back to organizationId.
 * Throws if tampered, malformed, or authentication fails.
 */
export function decryptTenantStoragePath(flatHex: string): string {
  if (!flatHex || typeof flatHex !== "string") {
    throw new Error("Invalid flat hex storage path")
  }

  // Minimum length: 24 (IV) + 32 (Tag) + 2 (at least 1 byte ciphertext) = 58 chars
  if (flatHex.length < 58 || !/^[0-9a-fA-F]+$/.test(flatHex)) {
    throw new Error("Malformed flat hex storage path")
  }

  const ivHex = flatHex.slice(0, 24)
  const tagHex = flatHex.slice(24, 56)
  const cipherHex = flatHex.slice(56)

  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const ciphertext = Buffer.from(cipherHex, "hex")

  const key = getStorageTenantSubkey()
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

/**
 * Validates that an encrypted flat hex storage path belongs to the given organizationId.
 */
export function verifyTenantStoragePath(
  flatHex: string,
  expectedOrgId: string
): boolean {
  try {
    const decrypted = decryptTenantStoragePath(flatHex)
    return decrypted === expectedOrgId
  } catch {
    return false
  }
}
