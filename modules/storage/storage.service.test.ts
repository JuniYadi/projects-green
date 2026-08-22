import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test"
import type { StorageFile } from "@prisma/client"

// Mock prisma before imports
const mockStorageFileStore: Map<string, StorageFile> = new Map()

const mockPrismaStorageFile = {
  create: mock(async ({ data }: { data: Partial<StorageFile> }) => {
    const id = data.id as string
    const now = new Date()
    const record = {
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      confirmedAt: null,
      publicUrl: null,
      metadata: {},
      expiresAt: null,
      uploadedByUserId: null,
      ...data,
      id,
    } as StorageFile
    mockStorageFileStore.set(id, record)
    return record
  }),
  findUnique: mock(
    async ({ where }: { where: { id?: string; storageKey?: string } }) => {
      if (where.id) return mockStorageFileStore.get(where.id) ?? null
      if (where.storageKey) {
        for (const f of mockStorageFileStore.values()) {
          if (f.storageKey === where.storageKey) return f
        }
      }
      return null
    }
  ),
  update: mock(
    async ({
      where,
      data,
    }: {
      where: { id: string }
      data: Partial<StorageFile>
    }) => {
      const existing = mockStorageFileStore.get(where.id)
      if (!existing) throw new Error("Record not found")
      const updated = { ...existing, ...data } as StorageFile
      mockStorageFileStore.set(where.id, updated)
      return updated
    }
  ),
  delete: mock(async ({ where }: { where: { id: string } }) => {
    const record = mockStorageFileStore.get(where.id)
    mockStorageFileStore.delete(where.id)
    return record
  }),
  groupBy: mock(async () => []),
  aggregate: mock(async () => ({
    _sum: { sizeBytes: BigInt(1024) },
    _count: { _all: 1 },
  })),
  findMany: mock(async () => Array.from(mockStorageFileStore.values())),
  count: mock(async () => mockStorageFileStore.size),
}

mock.module("@/lib/prisma", () => ({
  prisma: { storageFile: mockPrismaStorageFile },
}))

mock.module("@/lib/storage/s3-storage", () => ({
  buildS3StorageKey: ({
    organizationId,
    fileId,
    filename,
  }: {
    organizationId: string
    fileId: string
    filename: string
  }) => `tenants/${organizationId}/${fileId}/${filename}`,
  extractOrganizationIdFromS3Key: (key: string) => key.split("/")[1],
  getPresignedPutUrl: mock(async () => "https://s3.example.com/put-url"),
  getPresignedGetUrl: mock(async () => "https://s3.example.com/get-url"),
  statStorageFile: mock(async () => ({
    exists: true,
    size: 1024,
    type: "image/png",
  })),
  deleteStorageFile: mock(async () => {}),
  getS3Config: () => ({
    bucket: "test-bucket",
    region: "us-east-1",
    endpoint: "https://s3.example.com",
    prefix: "",
  }),
}))

import { StorageService } from "./storage.service"

describe("modules/storage - StorageService Unit Tests", () => {
  const orgA = "org_tenant_a_123"
  const orgB = "org_tenant_b_456"

  beforeEach(() => {
    process.env.APP_KEY = "test_master_secret_32_bytes_long_123456"
    mockStorageFileStore.clear()
    mockPrismaStorageFile.create.mockClear()
    mockPrismaStorageFile.findUnique.mockClear()
    mockPrismaStorageFile.update.mockClear()
    mockPrismaStorageFile.groupBy.mockClear()
    mockPrismaStorageFile.aggregate.mockClear()
    mockPrismaStorageFile.findMany.mockClear()
    mockPrismaStorageFile.count.mockClear()
  })

  afterEach(() => {
    mockStorageFileStore.clear()
  })

  it("should create presigned upload session, confirm, retrieve view, and check metrics", async () => {
    // --- createPresignedUpload ---
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

    // Verify record created in mock store
    const saved = mockStorageFileStore.get(presign.fileId)
    expect(saved?.status).toBe("PENDING")
    expect(saved?.organizationId).toBe(orgA)
    expect(saved?.originalFilename).toBe("test-banner.png")

    // --- confirmUpload ---
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
    await expect(
      StorageService.confirmUpload({
        organizationId: orgA,
        input: {
          fileId: presign.fileId,
          sizeBytes: 1024,
        },
      })
    ).rejects.toThrow("Cannot confirm file in ACTIVE status")

    // --- getTenantViewUrl ---
    const view = await StorageService.getTenantViewUrl({
      organizationId: orgA,
      fileId: presign.fileId,
    })
    expect(view.viewUrl).toBeDefined()
    expect(view.file.id).toBe(presign.fileId)

    // Cross-tenant access must fail
    await expect(
      StorageService.getTenantViewUrl({
        organizationId: orgB,
        fileId: presign.fileId,
      })
    ).rejects.toThrow("Forbidden: file does not belong to your organization")

    // --- getAdminMetrics ---
    const metrics = await StorageService.getAdminMetrics()
    expect(metrics.totalFiles).toBeGreaterThanOrEqual(1)

    // --- listAdminFiles ---
    const list = await StorageService.listAdminFiles({
      organizationId: orgA,
    })
    expect(list.items.some((i) => i.id === presign.fileId)).toBe(true)

    // --- forceDeleteFile ---
    const deleted = await StorageService.forceDeleteFile(presign.fileId)
    expect(deleted.status).toBe("DELETED")
  })
})
