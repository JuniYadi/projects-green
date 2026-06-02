import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16

export interface EncryptedData {
  encrypted: string
  iv: string
  tag: string
}

export function encrypt(plaintext: string, key: Buffer): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, "utf8", "base64")
  encrypted += cipher.final("base64")

  const tag = cipher.getAuthTag()

  return {
    encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  }
}

export function decrypt(data: EncryptedData, key: Buffer): string {
  const iv = Buffer.from(data.iv, "base64")
  const tag = Buffer.from(data.tag, "base64")
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

  decipher.setAuthTag(tag)

  let decrypted = decipher.update(data.encrypted, "base64", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

export function parseEncryptedField(value: string | null): EncryptedData | null {
  if (!value) return null
  try {
    return JSON.parse(value) as EncryptedData
  } catch {
    return null
  }
}

export function serializeEncryptedField(data: EncryptedData): string {
  return JSON.stringify(data)
}