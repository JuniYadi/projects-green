import { describe, expect, it } from "bun:test"

import {
  createSupportTicketContentCipher,
  SupportTicketCiphertextFormatError,
  SupportTicketDecryptionError,
  SupportTicketEncryptionConfigurationError,
} from "@/modules/support-tickets/support-ticket-content-cipher"

describe("supportTicketContentCipher", () => {
  it("encrypts and decrypts content with versioned payload", () => {
    const cipher = createSupportTicketContentCipher({
      key: "base64:bjY4kQV6Dj6MimVz5Zt2JYhjpQf8j2uZMQvNclTBIw4=",
    })
    const encrypted = cipher.encrypt("Sensitive text")

    expect(encrypted.startsWith("stenc.v1.")).toBe(true)
    expect(encrypted).not.toBe("Sensitive text")
    expect(cipher.decrypt(encrypted)).toBe("Sensitive text")
  })

  it("throws when key is missing", () => {
    expect(() =>
      createSupportTicketContentCipher({
        keyEnvName: "SUPPORT_TICKET_TEST_MISSING_KEY",
      })
    ).toThrow(SupportTicketEncryptionConfigurationError)
  })

  it("throws when key is invalid base64 or wrong size", () => {
    expect(() =>
      createSupportTicketContentCipher({
        key: "base64:not_base64",
      })
    ).toThrow(SupportTicketEncryptionConfigurationError)

    expect(() =>
      createSupportTicketContentCipher({
        key: "base64:YWJj",
      })
    ).toThrow(SupportTicketEncryptionConfigurationError)
  })

  it("throws on malformed payload", () => {
    const cipher = createSupportTicketContentCipher({
      key: "base64:bjY4kQV6Dj6MimVz5Zt2JYhjpQf8j2uZMQvNclTBIw4=",
    })

    expect(() => cipher.decrypt("invalid")).toThrow(
      SupportTicketCiphertextFormatError
    )
  })

  it("throws when payload cannot be decrypted with key", () => {
    const cipherA = createSupportTicketContentCipher({
      key: "base64:bjY4kQV6Dj6MimVz5Zt2JYhjpQf8j2uZMQvNclTBIw4=",
    })
    const cipherB = createSupportTicketContentCipher({
      key: "base64:S6oXgMw6DUblQQUsSExVK9mxJeGecS+quL6s6c+M6yQ=",
    })
    const encrypted = cipherA.encrypt("Sensitive text")

    expect(() => cipherB.decrypt(encrypted)).toThrow(
      SupportTicketDecryptionError
    )
  })
})
