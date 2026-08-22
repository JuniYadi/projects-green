import { describe, expect, it, mock, beforeEach } from "bun:test"
import { runStorageCleanupJob } from "./storage-cleanup.job"
import { prisma } from "@/lib/prisma"

describe("modules/storage/jobs/storage-cleanup.job", () => {
  it("should sweep expired pending files cleanly", async () => {
    const expiredDate = new Date(Date.now() - 3600 * 1000)

    // Insert dummy pending file
    const file = await prisma.storageFile.create({
      data: {
        organizationId: "org_cleanup_test",
        bucket: "test-bucket",
        storageKey: "test-key-cleanup-1",
        originalFilename: "test.png",
        mimeType: "image/png",
        status: "PENDING",
        expiresAt: expiredDate,
      },
    })

    const result = await runStorageCleanupJob(new Date())
    expect(result.sweptCount).toBeGreaterThanOrEqual(1)

    const updated = await prisma.storageFile.findUnique({
      where: { id: file.id },
    })
    expect(updated?.status).toBe("DELETED")
    expect(updated?.deletedAt).toBeDefined()

    // Clean up DB row
    await prisma.storageFile.delete({
      where: { id: file.id },
    })
  })
})
