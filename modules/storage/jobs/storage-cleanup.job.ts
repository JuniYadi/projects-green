import { prisma } from "@/lib/prisma"
import { deleteStorageFile } from "@/lib/storage/s3-storage"

export interface StorageCleanupResult {
  sweptCount: number
  deletedPhysicalCount: number
  errors: string[]
}

/**
 * Sweeps expired PENDING files and marks them DELETED while removing any physical S3 objects.
 */
export async function runStorageCleanupJob(
  now: Date = new Date()
): Promise<StorageCleanupResult> {
  const result: StorageCleanupResult = {
    sweptCount: 0,
    deletedPhysicalCount: 0,
    errors: [],
  }

  try {
    const expiredPendingFiles = await prisma.storageFile.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lte: now,
        },
      },
      take: 200,
    })

    for (const file of expiredPendingFiles) {
      try {
        await deleteStorageFile(file.storageKey)
        result.deletedPhysicalCount++

        await prisma.storageFile.update({
          where: { id: file.id },
          data: {
            status: "DELETED",
            deletedAt: now,
          },
        })
        result.sweptCount++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`File ${file.id} cleanup error: ${msg}`)
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    result.errors.push(`Job execution failure: ${msg}`)
  }

  return result
}
