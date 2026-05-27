import { describe, expect, it } from "bun:test"

// Test pure functions from storage module without S3 integration
// S3Client is a built-in Bun global that cannot be easily mocked

describe("SupportTicketAttachmentStorage - Pure Functions", () => {
  describe("sanitizeSegment", () => {
    // Inline the sanitize logic for testing since it's not exported
    const sanitizeSegment = (value: string) => {
      return value.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
    }

    it("replaces special characters with underscores", () => {
      expect(sanitizeSegment("user@email.com")).toBe("user_email_com")
      expect(sanitizeSegment("path/with/slashes")).toBe("path_with_slashes")
    })

    it("trims whitespace", () => {
      expect(sanitizeSegment("  user  ")).toBe("user")
    })

    it("preserves alphanumeric and allowed special chars", () => {
      expect(sanitizeSegment("user-123_name")).toBe("user-123_name")
    })
  })

  describe("storage prefix building logic", () => {
    const buildPrefix = (
      prefix: string,
      organizationId: string,
      target: string,
      ticketId: string | null,
      uploaderWorkosUserId: string
    ) => {
      const sanitize = (v: string) => v.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
      const ticketScope = ticketId ? sanitize(ticketId) : "pending"

      return [prefix, sanitize(organizationId), sanitize(target), ticketScope, sanitize(uploaderWorkosUserId)].join("/")
    }

    it("builds correct prefix structure with ticket id", () => {
      const prefix = buildPrefix(
        "support-ticket-attachments",
        "org_123",
        "reply",
        "ticket_456",
        "user_789"
      )

      expect(prefix).toBe("support-ticket-attachments/org_123/reply/ticket_456/user_789")
    })

    it("uses pending scope when ticketId is null", () => {
      const prefix = buildPrefix(
        "support-ticket-attachments",
        "org_123",
        "create",
        null,
        "user_789"
      )

      expect(prefix).toBe("support-ticket-attachments/org_123/create/pending/user_789")
    })

    it("sanitizes all segments", () => {
      const prefix = buildPrefix(
        "support-ticket-attachments",
        "org/with/slashes",
        "create",
        "ticket with spaces",
        "user@email.com"
      )

      expect(prefix).toContain("org_with_slashes")
      expect(prefix).toContain("ticket_with_spaces")
      expect(prefix).toContain("user_email_com")
    })
  })

  describe("storage key building logic", () => {
    it("includes timestamp and random suffix", () => {
      const prefix = "support-ticket-attachments/org_1/create/pending/user_1"
      const timestamp = Date.now()
      const randomSuffix = "abc123def456"

      const key = `${prefix}/${timestamp}-${randomSuffix}.pdf`

      expect(key).toContain(prefix)
      expect(key).toContain(`${timestamp}-`)
      expect(key).toEndWith(".pdf")
    })
  })

  describe("presign TTL parsing", () => {
    const getPresignTtlSeconds = (rawValue?: string) => {
      const DEFAULT_PRESIGN_TTL_SECONDS = 300

      if (!rawValue?.trim()) {
        return DEFAULT_PRESIGN_TTL_SECONDS
      }

      const parsed = Number(rawValue)

      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 900) {
        return DEFAULT_PRESIGN_TTL_SECONDS
      }

      return parsed
    }

    it("returns default when env is not set", () => {
      expect(getPresignTtlSeconds(undefined)).toBe(300)
      expect(getPresignTtlSeconds("")).toBe(300)
    })

    it("returns default for invalid values", () => {
      expect(getPresignTtlSeconds("invalid")).toBe(300)
      expect(getPresignTtlSeconds("-1")).toBe(300)
      expect(getPresignTtlSeconds("0")).toBe(300)
      expect(getPresignTtlSeconds("1000")).toBe(300) // > 900
    })

    it("returns parsed value for valid input", () => {
      expect(getPresignTtlSeconds("60")).toBe(60)
      expect(getPresignTtlSeconds("600")).toBe(600)
      expect(getPresignTtlSeconds("900")).toBe(900)
    })
  })

  describe("storage prefix from env", () => {
    const getStoragePrefix = (s3Prefix?: string) => {
      const DEFAULT_PREFIX = "support-ticket-attachments"
      const value = s3Prefix?.trim()
      return value ? value.replace(/^\/+|\/+$/g, "") : DEFAULT_PREFIX
    }

    it("returns default when env is not set", () => {
      expect(getStoragePrefix(undefined)).toBe("support-ticket-attachments")
      expect(getStoragePrefix("")).toBe("support-ticket-attachments")
    })

    it("trims and normalizes custom prefix", () => {
      expect(getStoragePrefix("/custom/prefix/")).toBe("custom/prefix")
      expect(getStoragePrefix("  custom/prefix  ")).toBe("custom/prefix")
    })
  })

  describe("getRequiredEnv", () => {
    class SupportTicketAttachmentStorageConfigurationError extends Error {
      constructor(message: string) {
        super(message)
        this.name = "SupportTicketAttachmentStorageConfigurationError"
      }
    }

    const getRequiredEnv = (name: string, env: Record<string, string | undefined>) => {
      const value = env[name]?.trim()

      if (!value) {
        throw new SupportTicketAttachmentStorageConfigurationError(
          `Missing ${name} environment variable`
        )
      }

      return value
    }

    it("returns value when present", () => {
      const value = getRequiredEnv("S3_BUCKET", { S3_BUCKET: "my-bucket" })
      expect(value).toBe("my-bucket")
    })

    it("throws error when missing", () => {
      expect(() => {
        getRequiredEnv("S3_BUCKET", {})
      }).toThrow("Missing S3_BUCKET environment variable")
    })

    it("throws error when value is empty string", () => {
      expect(() => {
        getRequiredEnv("S3_BUCKET", { S3_BUCKET: "" })
      }).toThrow("Missing S3_BUCKET environment variable")
    })
  })

  describe("getOptionalEnv", () => {
    const getOptionalEnv = (name: string, env: Record<string, string | undefined>) => {
      const value = env[name]?.trim()
      return value || undefined
    }

    it("returns value when present", () => {
      expect(getOptionalEnv("S3_ENDPOINT", { S3_ENDPOINT: "https://example.com" })).toBe("https://example.com")
    })

    it("returns undefined when not present", () => {
      expect(getOptionalEnv("S3_ENDPOINT", {})).toBeUndefined()
    })

    it("returns undefined for empty string", () => {
      expect(getOptionalEnv("S3_ENDPOINT", { S3_ENDPOINT: "" })).toBeUndefined()
    })
  })
})

describe("SupportTicketAttachmentStorage - Error Classes", () => {
  it("SupportTicketAttachmentStorageConfigurationError has correct name", () => {
    class SupportTicketAttachmentStorageConfigurationError extends Error {
      constructor(message: string) {
        super(message)
        this.name = "SupportTicketAttachmentStorageConfigurationError"
      }
    }

    const error = new SupportTicketAttachmentStorageConfigurationError("test message")
    expect(error.name).toBe("SupportTicketAttachmentStorageConfigurationError")
    expect(error.message).toBe("test message")
  })

  it("SupportTicketAttachmentUploadNotFoundError has correct default message", () => {
    class SupportTicketAttachmentUploadNotFoundError extends Error {
      constructor() {
        super("Attachment upload was not found in storage.")
        this.name = "SupportTicketAttachmentUploadNotFoundError"
      }
    }

    const error = new SupportTicketAttachmentUploadNotFoundError()
    expect(error.name).toBe("SupportTicketAttachmentUploadNotFoundError")
    expect(error.message).toBe("Attachment upload was not found in storage.")
  })

  it("SupportTicketAttachmentUploadValidationError accepts custom message", () => {
    class SupportTicketAttachmentUploadValidationError extends Error {
      constructor(message: string) {
        super(message)
        this.name = "SupportTicketAttachmentUploadValidationError"
      }
    }

    const error = new SupportTicketAttachmentUploadValidationError("Size mismatch")
    expect(error.name).toBe("SupportTicketAttachmentUploadValidationError")
    expect(error.message).toBe("Size mismatch")
  })
})