import { describe, expect, it, beforeEach } from "bun:test"
import {
  buildS3StorageKey,
  extractOrganizationIdFromS3Key,
  getS3Config,
} from "./s3-storage"

describe("lib/storage/s3-storage", () => {
  beforeEach(() => {
    process.env.APP_KEY = "test_master_secret_32_bytes_long_123456"
  })

  it("should generate config with default values", () => {
    const config = getS3Config()
    expect(config.bucket).toBeDefined()
  })

  it("should build structured S3 storage key with encrypted flat hex prefix", () => {
    const orgId = "org_unit_test_123"
    const fileId = "cuid_xyz_999"
    const filename = "My Header Image.PNG"
    const fixedDate = new Date("2026-08-22T10:00:00Z")

    const key = buildS3StorageKey({
      organizationId: orgId,
      fileId,
      filename,
      now: fixedDate,
    })

    const parts = key.split("/")
    expect(parts.length).toBe(4)

    // Check year and month
    expect(parts[1]).toBe("2026")
    expect(parts[2]).toBe("08")

    // Check sanitized filename
    expect(parts[3]).toBe("cuid_xyz_999_my_header_image.png")

    // Extract and verify org
    const extractedOrgId = extractOrganizationIdFromS3Key(key)
    expect(extractedOrgId).toBe(orgId)
  })

  it("should throw when extracting org from invalid key format", () => {
    expect(() => extractOrganizationIdFromS3Key("invalid-key")).toThrow()
  })
})
