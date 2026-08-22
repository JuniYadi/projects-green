import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { StorageFile } from "@prisma/client"

const mockFindMany = mock(async () => [] as StorageFile[])
const mockUpdate = mock(
  async ({ data }: { data: Partial<StorageFile> }) => data
)

mock.module("@/lib/prisma", () => ({
  prisma: {
    storageFile: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
  },
}))

mock.module("@/lib/storage/s3-storage", () => ({
  deleteStorageFile: mock(async () => {}),
}))

import { runStorageCleanupJob } from "./storage-cleanup.job"

describe("modules/storage/jobs/storage-cleanup.job", () => {
  beforeEach(() => {
    mockFindMany.mockClear()
    mockUpdate.mockClear()
  })

  it("should sweep expired pending files cleanly", async () => {
    const expiredDate = new Date(Date.now() - 3600 * 1000)
    const fakeFile: Partial<StorageFile> = {
      id: "file_cleanup_001",
      organizationId: "org_cleanup_test",
      bucket: "test-bucket",
      storageKey: "test-key-cleanup-1",
      originalFilename: "test.png",
      mimeType: "image/png",
      status: "PENDING",
      expiresAt: expiredDate,
    }

    mockFindMany.mockImplementation(async () => [fakeFile as StorageFile])
    mockUpdate.mockImplementation(
      async ({ data }: { data: Partial<StorageFile> }) => ({
        ...fakeFile,
        ...data,
      })
    )

    const result = await runStorageCleanupJob(new Date())

    expect(result.sweptCount).toBe(1)
    expect(result.deletedPhysicalCount).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: fakeFile.id },
        data: expect.objectContaining({ status: "DELETED" }),
      })
    )
  })

  it("should return zero swept when no expired files exist", async () => {
    mockFindMany.mockImplementation(async () => [])

    const result = await runStorageCleanupJob(new Date())

    expect(result.sweptCount).toBe(0)
    expect(result.deletedPhysicalCount).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it("should collect errors per file without aborting the whole job", async () => {
    const fakeFile: Partial<StorageFile> = {
      id: "file_err_001",
      storageKey: "bad-key",
      status: "PENDING",
    }

    mockFindMany.mockImplementation(async () => [fakeFile as StorageFile])
    mockUpdate.mockImplementation(async () => {
      throw new Error("DB write failed")
    })

    const result = await runStorageCleanupJob(new Date())

    expect(result.sweptCount).toBe(0)
    expect(result.errors.length).toBeGreaterThanOrEqual(1)
    expect(result.errors[0]).toContain("file_err_001")
  })
})
