import {
  encrypt,
  decrypt,
  parseEncryptedField,
  serializeEncryptedField,
} from "@/lib/encryption"

export class EncryptionService {
  private key: Buffer

  constructor(key: string) {
    // Key should be 32 bytes for AES-256
    this.key = Buffer.from(key, "hex")
    if (this.key.length !== 32) {
      throw new Error("Encryption key must be 32 bytes (64 hex characters)")
    }
  }

  encryptField(value: string): string {
    const encrypted = encrypt(value, this.key)
    return serializeEncryptedField(encrypted)
  }

  decryptField(encryptedValue: string): string {
    const data = parseEncryptedField(encryptedValue)
    if (!data) {
      throw new Error("Invalid encrypted field format")
    }
    return decrypt(data, this.key)
  }

  decryptFieldOptional(encryptedValue: string | null): string | null {
    if (!encryptedValue) return null
    try {
      return this.decryptField(encryptedValue)
    } catch {
      return null
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