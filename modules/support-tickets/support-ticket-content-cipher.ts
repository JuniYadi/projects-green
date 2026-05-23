import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const AES_GCM_ALGORITHM = "aes-256-gcm"
const AES_GCM_KEY_BYTES = 32
const AES_GCM_IV_BYTES = 12
const PAYLOAD_PREFIX = "stenc"
const PAYLOAD_VERSION = "v1"
const PAYLOAD_SEGMENT_COUNT = 5
const DEFAULT_KEY_ENV_NAME = "SUPPORT_TICKET_CONTENT_ENCRYPTION_KEY"
const PAYLOAD_PREFIX_VERSION = `${PAYLOAD_PREFIX}.${PAYLOAD_VERSION}.`

export class SupportTicketEncryptionConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SupportTicketEncryptionConfigurationError"
  }
}

export class SupportTicketCiphertextFormatError extends Error {
  constructor() {
    super("Support ticket ciphertext payload is malformed.")
    this.name = "SupportTicketCiphertextFormatError"
  }
}

export class SupportTicketDecryptionError extends Error {
  constructor() {
    super("Support ticket ciphertext cannot be decrypted.")
    this.name = "SupportTicketDecryptionError"
  }
}

export type SupportTicketContentCipher = {
  decrypt(value: string): string
  encrypt(value: string): string
}

export const isSupportTicketEncryptedPayload = (value: string) => {
  return value.startsWith(PAYLOAD_PREFIX_VERSION)
}

const parseBase64Key = (value: string) => {
  const normalizedValue = value.trim()
  const rawValue = normalizedValue.startsWith("base64:")
    ? normalizedValue.slice("base64:".length)
    : normalizedValue

  if (!rawValue) {
    throw new SupportTicketEncryptionConfigurationError(
      "Support ticket encryption key cannot be empty."
    )
  }

  const key = Buffer.from(rawValue, "base64")
  const canonicalRawValue = key.toString("base64").replace(/=+$/g, "")
  const canonicalInput = rawValue.replace(/=+$/g, "")

  if (!key.length || canonicalRawValue !== canonicalInput) {
    throw new SupportTicketEncryptionConfigurationError(
      "Support ticket encryption key must be valid base64."
    )
  }

  if (key.length !== AES_GCM_KEY_BYTES) {
    throw new SupportTicketEncryptionConfigurationError(
      "Support ticket encryption key must decode to 32 bytes."
    )
  }

  return key
}

const toPayload = (iv: Buffer, authTag: Buffer, ciphertext: Buffer) => {
  return [
    PAYLOAD_PREFIX,
    PAYLOAD_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

const parsePayload = (payload: string) => {
  const segments = payload.split(".")

  if (
    segments.length !== PAYLOAD_SEGMENT_COUNT ||
    segments[0] !== PAYLOAD_PREFIX ||
    segments[1] !== PAYLOAD_VERSION
  ) {
    throw new SupportTicketCiphertextFormatError()
  }

  const ivEncoded = segments[2]
  const authTagEncoded = segments[3]
  const ciphertextEncoded = segments[4]

  if (!ivEncoded || !authTagEncoded || !ciphertextEncoded) {
    throw new SupportTicketCiphertextFormatError()
  }

  const iv = Buffer.from(ivEncoded, "base64url")
  const authTag = Buffer.from(authTagEncoded, "base64url")
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url")

  if (iv.length !== AES_GCM_IV_BYTES || !authTag.length || !ciphertext.length) {
    throw new SupportTicketCiphertextFormatError()
  }

  return { iv, authTag, ciphertext }
}

type CreateSupportTicketContentCipherOptions = {
  key?: string
  keyEnvName?: string
}

export const createSupportTicketContentCipher = (
  options: CreateSupportTicketContentCipherOptions = {}
): SupportTicketContentCipher => {
  const keyEnvName = options.keyEnvName ?? DEFAULT_KEY_ENV_NAME
  const keyValue = options.key ?? process.env[keyEnvName]

  if (!keyValue) {
    throw new SupportTicketEncryptionConfigurationError(
      `Missing ${keyEnvName} environment variable.`
    )
  }

  const key = parseBase64Key(keyValue)

  return {
    encrypt(value) {
      const iv = randomBytes(AES_GCM_IV_BYTES)
      const cipher = createCipheriv(AES_GCM_ALGORITHM, key, iv)
      const ciphertext = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ])
      const authTag = cipher.getAuthTag()

      return toPayload(iv, authTag, ciphertext)
    },
    decrypt(value) {
      const { iv, authTag, ciphertext } = parsePayload(value)

      try {
        const decipher = createDecipheriv(AES_GCM_ALGORITHM, key, iv)
        decipher.setAuthTag(authTag)

        return Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]).toString("utf8")
      } catch {
        throw new SupportTicketDecryptionError()
      }
    },
  }
}
