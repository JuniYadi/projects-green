import { describe, expect, it, beforeEach, mock } from "bun:test"
import { StorageService } from "./storage.service"
import { prisma } from "@/lib/prisma"
import * as s3Storage from "@/lib/storage/s3-storage"

describe("modules/storage - StorageService Integration Tests", () => {
  const orgA = "org_tenant_a_123"
  const orgB = "org_tenant_b_456"

  beforeEach(() => {
    process.env.APP_KEY = "test_master_secret_32_bytes_long_123456"
  })

  it("should create presigned upload session, confirm, retrieve view, and check metrics", async () => {
    // Mock statStorageFile to return exists: true with size: 1024 for integration test
    const originalStat = s3Storage.statStorageFile
    mock.module("@/lib/storage/s3-storage", () => ({
      ...s3Storage,
      statStorageFile: async () => ({
        exists: true,
        size: 1024,
        type: "image/png",
      }),
    }))

    const presign = await StorageService.createPresignedUpload({
      organizationId: orgA,
      userId: "user_123",
      input: {
        filename: "test-banner.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        purpose: "whatsapp",
      },
    })

    expect(presign.fileId).toBeDefined()
    expect(presign.storageKey).toBeDefined()
    expect(presign.uploadUrl).toBeDefined()
    expect(presign.purpose).toBe("whatsapp")

    const saved = await prisma.storageFile.findUnique({
      where: { id: presign.fileId },
    })
    expect(saved?.status).toBe("PENDING")
    expect(saved?.organizationId).toBe(orgA)
    expect(saved?.originalFilename).toBe("test-banner.png")

    // Confirm upload
    const confirmed = await StorageService.confirmUpload({
      organizationId: orgA,
      input: {
        fileId: presign.fileId,
        sizeBytes: 1024,
      },
    })
    expect(confirmed.status).toBe("ACTIVE")
    expect(confirmed.confirmedAt).toBeDefined()

    // Confirming already-ACTIVE record must throw status guard error
    expect(
      StorageService.confirmUpload({
        organizationId: orgA,
        input: {
          fileId: presign.fileId,
          sizeBytes: 1024,
        },
      })
    ).rejects.toThrow("Cannot confirm file in ACTIVE status")

    // Retrieve view url
    const view = await StorageService.getTenantViewUrl({
      organizationId: orgA,
      fileId: presign.fileId,
    })
    expect(view.viewUrl).toBeDefined()
    expect(view.file.id).toBe(presign.fileId)

    // Cross-tenant access must fail
    expect(
      StorageService.getTenantViewUrl({
        organizationId: orgB,
        fileId: presign.fileId,
      })
    ).rejects.toThrow("Forbidden: file does not belong to your organization")

    // Admin metrics check with groupBy + aggregate
    const metrics = await StorageService.getAdminMetrics()
    expect(metrics.totalFiles).toBeGreaterThanOrEqual(1)
    expect(metrics.activeFiles).toBeGreaterThanOrEqual(1)

    // Admin list check
    const list = await StorageService.listAdminFiles({
      organizationId: orgA,
    })
    expect(list.items.some((i) => i.id === presign.fileId)).toBe(true)

    // Admin force delete
    const deleted = await StorageService.forceDeleteFile(presign.fileId)
    expect(deleted.status).toBe("DELETED")

    // Cleanup
    await prisma.storageFile.delete({
      where: { id: presign.fileId },
    })
  })
})
