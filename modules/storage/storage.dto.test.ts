import { describe, expect, it } from "bun:test"
import {
  toStorageFileDTO,
  PresignUploadRequestSchema,
  ConfirmUploadRequestSchema,
} from "./storage.dto"
import type { StorageFile } from "@prisma/client"

describe("modules/storage/storage.dto", () => {
  it("validates presign upload schema correctly with proper filename and mimeType", () => {
    const valid = PresignUploadRequestSchema.safeParse({
      filename: "test.png",
      mimeType: "image/png",
      purpose: "whatsapp",
    })
    expect(valid.success).toBe(true)

    // Rejects invalid strings without extension or invalid MIME format
    const invalidLiteral = PresignUploadRequestSchema.safeParse({
      filename: "string",
      mimeType: "string",
    })
    expect(invalidLiteral.success).toBe(false)

    const invalidEmpty = PresignUploadRequestSchema.safeParse({
      filename: "",
      mimeType: "",
    })
    expect(invalidEmpty.success).toBe(false)
  })

  it("validates confirm upload schema correctly", () => {
    const valid = ConfirmUploadRequestSchema.safeParse({
      fileId: "cuid_123",
      sizeBytes: 1024,
    })
    expect(valid.success).toBe(true)
  })

  it("transforms Prisma StorageFile model to DTO cleanly", () => {
    const now = new Date()
    const mockFile: StorageFile = {
      id: "cl_1",
      organizationId: "org_1",
      uploadedByUserId: "usr_1",
      purpose: "whatsapp",
      bucket: "test-bucket",
      storageKey: "key/1",
      originalFilename: "banner.jpg",
      mimeType: "image/jpeg",
      sizeBytes: BigInt(2048),
      status: "ACTIVE",
      publicUrl: "https://example.com/banner.jpg",
      metadata: { width: 800 },
      expiresAt: null,
      confirmedAt: now,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    const dto = toStorageFileDTO(mockFile)
    expect(dto.id).toBe("cl_1")
    expect(dto.sizeBytes).toBe(2048)
    expect(dto.status).toBe("ACTIVE")
    expect(dto.confirmedAt).toBe(now.toISOString())
  })
})
