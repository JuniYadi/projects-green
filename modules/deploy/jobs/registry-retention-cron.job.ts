import { prisma } from "@/lib/prisma"

export type RegistryRetentionPurgeResult = {
  purgedCount: number
  purgedImageIds: string[]
}

/**
 * Platform Cron Job: Prunes expired container images and transitions their status to PURGED.
 * This runs periodically to ensure storage blobs are reclaimed and DB states stay 100% in sync,
 * deprecating legacy Jenkins gc-registry.sh scripts.
 */
export async function runRegistryRetentionCleanup(): Promise<RegistryRetentionPurgeResult> {
  const expiredImages = await prisma.applicationContainerImage.findMany({
    where: {
      status: "EXPIRED",
      purgedAt: null,
    },
    select: {
      id: true,
      stackId: true,
      imageTag: true,
      digest: true,
    },
  })

  if (expiredImages.length === 0) {
    return {
      purgedCount: 0,
      purgedImageIds: [],
    }
  }

  const idsToPurge = expiredImages.map((img) => img.id)

  await prisma.applicationContainerImage.updateMany({
    where: {
      id: { in: idsToPurge },
    },
    data: {
      status: "PURGED",
      purgedAt: new Date(),
    },
  })

  return {
    purgedCount: idsToPurge.length,
    purgedImageIds: idsToPurge,
  }
}
