import {
  encrypt,
  decrypt,
  parseEncryptedField,
  serializeEncryptedField,
} from "@/lib/encryption"

export class EncryptionService {
  private key: Buffer | null = null
  private readonly rawKey: string

  constructor(key: string) {
    this.rawKey = key
  }

  private getKey(): Buffer {
    if (!this.key) {
      // Key should be 32 bytes for AES-256. Validate lazily so read-only
      // payment availability endpoints can still respond with JSON errors or
      // decrypted-field fallbacks instead of failing route module startup.
      const key = Buffer.from(this.rawKey, "hex")
      if (key.length !== 32) {
        throw new Error("Encryption key must be 32 bytes (64 hex characters)")
      }
      this.key = key
    }

    return this.key
  }

  encryptField(value: string): string {
    const encrypted = encrypt(value, this.getKey())
    return serializeEncryptedField(encrypted)
  }

  decryptField(encryptedValue: string): string {
    const data = parseEncryptedField(encryptedValue)
    if (!data) {
      throw new Error("Invalid encrypted field format")
    }
    return decrypt(data, this.getKey())
  }

  decryptFieldOptional(encryptedValue: string | null): string | null {
    if (!encryptedValue) return null
    try {
      return this.decryptField(encryptedValue)
    } catch {
      // Fallback: if the value is not valid encrypted JSON, return it as-is
      // (handles plain-text values stored before encryption was enforced)
      return encryptedValue
    }
  }
}

// Default instance with env var
let defaultInstance: EncryptionService | null = null

export function getEncryptionService(): EncryptionService {
  if (!defaultInstance) {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable is not set")
    }
    defaultInstance = new EncryptionService(key)
  }
  return defaultInstance
}

// For testing - reset the default instance
export function resetEncryptionService(): void {
  defaultInstance = null
}
