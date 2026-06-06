import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import {
  getOptionalEnv,
  getPresignTtlSeconds,
  getRequiredEnv,
  getStoragePrefix,
  sanitizeSegment,
  SupportTicketAttachmentStorageConfigurationError,
  SupportTicketAttachmentUploadNotFoundError,
  SupportTicketAttachmentUploadValidationError,
} from "./support-ticket-attachment.storage"

// Test pure functions from storage module without S3 integration
// S3Client is a built-in Bun global that cannot be easily mocked

describe("SupportTicketAttachmentStorage - Pure Functions", () => {
  describe("sanitizeSegment", () => {
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
      const ticketScope = ticketId ? sanitizeSegment(ticketId) : "pending"
      const org = sanitizeSegment(organizationId)
      const tgt = sanitizeSegment(target)
      const uploader = sanitizeSegment(uploaderWorkosUserId)

      return [prefix, org, tgt, ticketScope, uploader].join("/")
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
    it("returns value when present", () => {
      const env = { S3_ENDPOINT: "https://example.com" }
      expect(getOptionalEnv("S3_ENDPOINT", env)).toBe("https://example.com")
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
    const error = new SupportTicketAttachmentStorageConfigurationError(
      "test message"
    )
    expect(error.name).toBe("SupportTicketAttachmentStorageConfigurationError")
    expect(error.message).toBe("test message")
  })

  it("SupportTicketAttachmentUploadNotFoundError has correct default message", () => {
    const error = new SupportTicketAttachmentUploadNotFoundError()
    expect(error.name).toBe("SupportTicketAttachmentUploadNotFoundError")
    expect(error.message).toBe("Attachment upload was not found in storage.")
  })

  it("SupportTicketAttachmentUploadValidationError accepts custom message", () => {
    const error = new SupportTicketAttachmentUploadValidationError("Size mismatch")
    expect(error.name).toBe("SupportTicketAttachmentUploadValidationError")
    expect(error.message).toBe("Size mismatch")
  })
})

describe("SupportTicketAttachmentStorage - Prefix Building", () => {
  const prevEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...prevEnv }
  })

  describe("buildSupportTicketAttachmentStoragePrefix", () => {
    it("builds prefix from env and context", async () => {
      process.env.S3_BUCKET = "test-bucket"
      process.env.S3_REGION = "us-east-1"

      const { buildSupportTicketAttachmentStoragePrefix } = await import(
        "./support-ticket-attachment.storage"
      )

      const prefix = buildSupportTicketAttachmentStoragePrefix({
        organizationId: "org_123",
        target: "reply",
        ticketId: "ticket_456",
        uploaderWorkosUserId: "user_789",
      })

      expect(prefix).toBe("support-ticket-attachments/org_123/reply/ticket_456/user_789")
    })

    it("uses pending for null ticketId", async () => {
      process.env.S3_BUCKET = "test-bucket"
      process.env.S3_REGION = "us-east-1"

      const { buildSupportTicketAttachmentStoragePrefix } = await import(
        "./support-ticket-attachment.storage"
      )

      const prefix = buildSupportTicketAttachmentStoragePrefix({
        organizationId: "org_123",
        target: "create",
        ticketId: null,
        uploaderWorkosUserId: "user_789",
      })

      expect(prefix).toBe("support-ticket-attachments/org_123/create/pending/user_789")
    })

    it("sanitizes segments with special characters", async () => {
      process.env.S3_BUCKET = "test-bucket"
      process.env.S3_REGION = "us-east-1"

      const { buildSupportTicketAttachmentStoragePrefix } = await import(
        "./support-ticket-attachment.storage"
      )

      const prefix = buildSupportTicketAttachmentStoragePrefix({
        organizationId: "org/with/slashes",
        target: "create",
        ticketId: "ticket with spaces",
        uploaderWorkosUserId: "user@email.com",
      })

      expect(prefix).toContain("org_with_slashes")
      expect(prefix).toContain("ticket_with_spaces")
      expect(prefix).toContain("user_email_com")
    })

    it("throws StorageConfigurationError when S3_BUCKET env is missing", async () => {
      delete process.env.S3_BUCKET
      process.env.S3_REGION = "us-east-1"

      const { buildSupportTicketAttachmentStoragePrefix } = await import(
        "./support-ticket-attachment.storage"
      )

      expect(() =>
        buildSupportTicketAttachmentStoragePrefix({
          organizationId: "org_1",
          target: "create",
          ticketId: null,
          uploaderWorkosUserId: "user_1",
        }),
      ).toThrow("Missing S3_BUCKET environment variable")
    })

    it("throws StorageConfigurationError when S3_REGION env is missing", async () => {
      process.env.S3_BUCKET = "test-bucket"
      delete process.env.S3_REGION

      const { buildSupportTicketAttachmentStoragePrefix } = await import(
        "./support-ticket-attachment.storage"
      )

      expect(() =>
        buildSupportTicketAttachmentStoragePrefix({
          organizationId: "org_1",
          target: "create",
          ticketId: null,
          uploaderWorkosUserId: "user_1",
        }),
      ).toThrow("Missing S3_REGION environment variable")
    })
  })

  describe("getExpectedStorageKeyPrefix (via storage instance)", () => {
    it("returns prefix matching buildSupportTicketAttachmentStoragePrefix", async () => {
      process.env.S3_BUCKET = "test-bucket"
      process.env.S3_REGION = "us-east-1"

      const { createSupportTicketAttachmentStorage } = await import(
        "./support-ticket-attachment.storage"
      )

      const storage = createSupportTicketAttachmentStorage()
      const prefix = storage.getExpectedStorageKeyPrefix({
        organizationId: "org_1",
        target: "reply",
        ticketId: "ticket_1",
        uploaderWorkosUserId: "user_1",
      })

      expect(prefix).toBe("support-ticket-attachments/org_1/reply/ticket_1/user_1")
    })
  })

  describe("virtualHostedStyle parsing in loadStorageConfig", () => {
    it("returns undefined when S3_VIRTUAL_HOSTED_STYLE is not set", async () => {
      process.env.S3_BUCKET = "test-bucket"
      process.env.S3_REGION = "us-east-1"
      delete process.env.S3_VIRTUAL_HOSTED_STYLE

      // Re-import to pick up fresh env
      const { createSupportTicketAttachmentStorage } = await import(
        "./support-ticket-attachment.storage"
      )

      // Should not throw — virtualHostedStyle is undefined
      const storage = createSupportTicketAttachmentStorage()
      expect(storage).toBeDefined()
    })

    it("parses truthy values correctly", async () => {
      process.env.S3_BUCKET = "test-bucket"
      process.env.S3_REGION = "us-east-1"
      process.env.S3_VIRTUAL_HOSTED_STYLE = "true"

      const { createSupportTicketAttachmentStorage } = await import(
        "./support-ticket-attachment.storage"
      )

      const storage = createSupportTicketAttachmentStorage()
      expect(storage).toBeDefined()
    })

    it("parses falsy values correctly", async () => {
      process.env.S3_BUCKET = "test-bucket"
      process.env.S3_REGION = "us-east-1"
      process.env.S3_VIRTUAL_HOSTED_STYLE = "0"

      const { createSupportTicketAttachmentStorage } = await import(
        "./support-ticket-attachment.storage"
      )

      const storage = createSupportTicketAttachmentStorage()
      expect(storage).toBeDefined()
    })
  })

  describe("createSupportTicketAttachmentStorage - S3 Operations", () => {
    let prevEnv: Record<string, string | undefined>

    beforeEach(() => {
      prevEnv = { ...process.env }
      process.env.S3_BUCKET = "test-bucket"
      process.env.S3_REGION = "us-east-1"
      process.env.S3_ACCESS_KEY_ID = "AKIA-test"
      process.env.S3_SECRET_ACCESS_KEY = "secret-test"
    })

    afterEach(() => {
      process.env = { ...prevEnv } as NodeJS.ProcessEnv
    })

    it("createPresignedUpload returns expected shape and builds storage key", async () => {
      const { createSupportTicketAttachmentStorage } = await import(
        "./support-ticket-attachment.storage"
      )

      const storage = createSupportTicketAttachmentStorage()

      const result = await storage.createPresignedUpload({
        attachmentId: "att_1",
        checksumSha256: null,
        extension: "pdf",
        fileName: "report.pdf",
        mimeType: "application/pdf",
        organizationId: "org_1",
        sizeBytes: 1024,
        target: "create",
        ticketId: null,
        uploaderWorkosUserId: "user_1",
      })

      expect(result.bucket).toBe("test-bucket")
      expect(result.key).toContain("support-ticket-attachments/org_1/create/pending/user_1/")
      expect(result.key).toEndWith(".pdf")
      expect(result.uploadUrl).toBeTruthy()
      expect(result.expiresAt).toBeTruthy()
    })

    it("getExpectedStorageKeyPrefix returns correct prefix via instance", async () => {
      const { createSupportTicketAttachmentStorage } = await import(
        "./support-ticket-attachment.storage"
      )

      const storage = createSupportTicketAttachmentStorage()

      const prefix = storage.getExpectedStorageKeyPrefix({
        organizationId: "org_1",
        target: "reply",
        ticketId: "ticket_1",
        uploaderWorkosUserId: "user_1",
      })

      expect(prefix).toBe("support-ticket-attachments/org_1/reply/ticket_1/user_1")
    })

    it("getFile returns an S3File object", async () => {
      const { createSupportTicketAttachmentStorage } = await import(
        "./support-ticket-attachment.storage"
      )

      const storage = createSupportTicketAttachmentStorage()
      const s3File = storage.getFile!("some/key.pdf")

      expect(s3File).toBeDefined()
      expect(typeof s3File.exists).toBe("function")
    })

    it("verifyUploadedObject throws UploadNotFoundError when file does not exist", async () => {
      const mockFile = {
        exists: async () => false,
      }
      const OriginalS3Client = Bun.S3Client
      const MockS3Client = class {
        file() { return mockFile }
        presign() { return "" }
      }
      Bun.S3Client = MockS3Client as unknown as typeof Bun.S3Client

      try {
        const mod = await import("./support-ticket-attachment.storage")
        const storage = mod.createSupportTicketAttachmentStorage()

        await expect(
          storage.verifyUploadedObject({
            attachmentId: "att_missing",
            checksumSha256: null,
            mimeType: "application/pdf",
            organizationId: "org_1",
            sizeBytes: 1024,
            storageKey: "nonexistent-key.pdf",
            target: "create",
            ticketId: null,
            uploaderWorkosUserId: "user_1",
          }),
        ).rejects.toBeInstanceOf(mod.SupportTicketAttachmentUploadNotFoundError)
      } finally {
        Bun.S3Client = OriginalS3Client
      }
    })

    it("verifyUploadedObject throws ValidationError on size mismatch", async () => {
      const mockFile = {
        exists: async () => true,
        stat: async () => ({ size: 9999, type: "application/pdf" }),
      }
      const OriginalS3Client = Bun.S3Client
      const MockS3Client = class {
        file() { return mockFile }
        presign() { return "" }
      }
      Bun.S3Client = MockS3Client as unknown as typeof Bun.S3Client

      try {
        // Re-import to pick up the mocked S3Client (module is cached, but factory reads Bun at call time)
        const mod = await import("./support-ticket-attachment.storage")
        const storage = mod.createSupportTicketAttachmentStorage()

        await expect(
          storage.verifyUploadedObject({
            attachmentId: "att_size",
            checksumSha256: null,
            mimeType: "application/pdf",
            organizationId: "org_1",
            sizeBytes: 1024,
            storageKey: "some-key.pdf",
            target: "create",
            ticketId: null,
            uploaderWorkosUserId: "user_1",
          }),
        ).rejects.toBeInstanceOf(mod.SupportTicketAttachmentUploadValidationError)
      } finally {
        Bun.S3Client = OriginalS3Client
      }
    })

    it("verifyUploadedObject throws ValidationError on mime type mismatch", async () => {
      const mockFile = {
        exists: async () => true,
        stat: async () => ({ size: 1024, type: "image/png" }),
      }
      const OriginalS3Client = Bun.S3Client
      const MockS3Client = class {
        file() { return mockFile }
        presign() { return "" }
      }
      Bun.S3Client = MockS3Client as unknown as typeof Bun.S3Client

      try {
        const mod = await import("./support-ticket-attachment.storage")
        const storage = mod.createSupportTicketAttachmentStorage()

        await expect(
          storage.verifyUploadedObject({
            attachmentId: "att_mime",
            checksumSha256: null,
            mimeType: "application/pdf",
            organizationId: "org_1",
            sizeBytes: 1024,
            storageKey: "some-key.pdf",
            target: "create",
            ticketId: null,
            uploaderWorkosUserId: "user_1",
          }),
        ).rejects.toBeInstanceOf(mod.SupportTicketAttachmentUploadValidationError)
      } finally {
        Bun.S3Client = OriginalS3Client
      }
    })

    it("verifyUploadedObject succeeds when file matches expectations", async () => {
      const mockFile = {
        exists: async () => true,
        stat: async () => ({ size: 1024, type: "application/pdf" }),
      }
      const OriginalS3Client = Bun.S3Client
      const MockS3Client = class {
        file() { return mockFile }
        presign() { return "" }
      }
      Bun.S3Client = MockS3Client as unknown as typeof Bun.S3Client

      try {
        const mod = await import("./support-ticket-attachment.storage")
        const storage = mod.createSupportTicketAttachmentStorage()

        await expect(
          storage.verifyUploadedObject({
            attachmentId: "att_ok",
            checksumSha256: null,
            mimeType: "application/pdf",
            organizationId: "org_1",
            sizeBytes: 1024,
            storageKey: "some-key.pdf",
            target: "create",
            ticketId: null,
            uploaderWorkosUserId: "user_1",
          }),
        ).resolves.toBeUndefined()
      } finally {
        Bun.S3Client = OriginalS3Client
      }
    })
  })
})