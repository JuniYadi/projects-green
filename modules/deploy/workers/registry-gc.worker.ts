import { prisma } from "@/lib/prisma"
import {
  createRegistryS3Client,
  listAllKeysWithClient,
  deleteRegistryKeyWithClient,
  readManifestJsonWithClient,
} from "@/lib/storage/registry-s3"
import { resolveClusterIntegration } from "@/modules/deploy/cluster-integration.service"
import { logger } from "@/lib/logger"

export type RegistryGcResult = {
  imageSlug: string
  manifestsDeleted: number
  blobsDeleted: number
  skipped: boolean
  skipReason?: string
}

export type RegistryGcJobResult = {
  processedImages: number
  totalManifestsDeleted: number
  totalBlobsDeleted: number
  results: RegistryGcResult[]
}

function stripPrefix(digest: string): string {
  return digest.startsWith("sha256:") ? digest.slice(7) : digest
}

function extractBlobDigests(manifest: Record<string, unknown>): Set<string> {
  const digests = new Set<string>()

  if (typeof manifest.config === "object" && manifest.config !== null) {
    const config = manifest.config as Record<string, unknown>
    if (typeof config.digest === "string") {
      digests.add(stripPrefix(config.digest))
    }
  }

  if (Array.isArray(manifest.layers)) {
    for (const layer of manifest.layers) {
      if (typeof layer === "object" && layer !== null) {
        const l = layer as Record<string, unknown>
        if (typeof l.digest === "string") {
          digests.add(stripPrefix(l.digest))
        }
      }
    }
  }

  return digests
}

/**
 * GC a single image slug in the registry, resolving cluster configuration dynamically.
 */
export async function gcRegistryImage(
  imageSlug: string
): Promise<RegistryGcResult> {
  const stack = await prisma.applicationStack.findFirst({
    where: { slug: imageSlug },
    select: { id: true },
  })

  if (!stack) {
    return {
      imageSlug,
      manifestsDeleted: 0,
      blobsDeleted: 0,
      skipped: true,
      skipReason: "Stack not found in DB — skipping to avoid accidental GC",
    }
  }

  // 1. Resolve cluster integration for this stack's cluster
  let registryConfig
  try {
    registryConfig = await resolveClusterIntegration(stack.id, "REGISTRY")
  } catch (err) {
    return {
      imageSlug,
      manifestsDeleted: 0,
      blobsDeleted: 0,
      skipped: true,
      skipReason: `Failed to resolve cluster registry integration: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const s3Bucket = registryConfig.s3Bucket || registryConfig.host
  if (!s3Bucket) {
    return {
      imageSlug,
      manifestsDeleted: 0,
      blobsDeleted: 0,
      skipped: true,
      skipReason: "Cluster REGISTRY integration missing s3Bucket or host",
    }
  }

  const s3Client = createRegistryS3Client({
    bucket: s3Bucket,
    endpoint: registryConfig.s3Endpoint || undefined,
    region: registryConfig.s3Region || undefined,
    accessKeyId: registryConfig.s3AccessKeyId || undefined,
    secretAccessKey: registryConfig.s3SecretAccessKey || undefined,
  })

  const manifestPrefix = `v2/${imageSlug}/manifests/`
  const blobPrefix = `v2/${imageSlug}/blobs/`

  // 2. List all manifest keys in S3
  const allManifestKeys = await listAllKeysWithClient(s3Client, manifestPrefix)
  if (allManifestKeys.length === 0) {
    return {
      imageSlug,
      manifestsDeleted: 0,
      blobsDeleted: 0,
      skipped: true,
      skipReason: "No manifests found in registry bucket",
    }
  }

  const tagManifestKeys = allManifestKeys.filter((k) => {
    const name = k.slice(manifestPrefix.length)
    return !name.startsWith("sha256:") && name !== "latest" && name !== ""
  })
  const digestManifestKeys = allManifestKeys.filter((k) => {
    const name = k.slice(manifestPrefix.length)
    return name.startsWith("sha256:")
  })

  // 3. Query DB for container image statuses
  const allDbImages = await prisma.applicationContainerImage.findMany({
    where: { stackId: stack.id },
    select: { imageTag: true, status: true },
  })

  const tagsToKeep = new Set(
    allDbImages
      .filter((img) => img.status === "ACTIVE" || img.status === "READY")
      .map((img) => img.imageTag)
  )

  const tagsToDelete = new Set(
    allDbImages
      .filter((img) => img.status === "EXPIRED" || img.status === "PURGED")
      .map((img) => img.imageTag)
  )

  // 4. Build referenced blobs from kept tag manifests
  const referencedBlobs = new Set<string>()
  const neededDigestManifests = new Set<string>()

  for (const tagKey of tagManifestKeys) {
    const tagName = tagKey.slice(manifestPrefix.length)
    if (!tagsToKeep.has(tagName)) continue

    const manifest = await readManifestJsonWithClient(s3Client, tagKey)
    if (!manifest) continue

    if (Array.isArray(manifest.manifests)) {
      for (const sub of manifest.manifests) {
        if (typeof sub === "object" && sub !== null) {
          const s = sub as Record<string, unknown>
          if (typeof s.digest === "string") {
            neededDigestManifests.add(s.digest)
          }
        }
      }
    } else {
      const blobs = extractBlobDigests(manifest)
      for (const b of blobs) referencedBlobs.add(b)
    }
  }

  // 5. List all blobs in S3
  const allBlobKeys = await listAllKeysWithClient(s3Client, blobPrefix)
  const existingBlobHashes = new Set(
    allBlobKeys.map((k) => stripPrefix(k.slice(blobPrefix.length)))
  )

  // 6. Delete orphaned blobs
  let blobsDeleted = 0
  for (const hash of existingBlobHashes) {
    if (!referencedBlobs.has(hash)) {
      const key = `${blobPrefix}sha256:${hash}`
      const ok = await deleteRegistryKeyWithClient(s3Client, key)
      if (ok) {
        blobsDeleted++
        logger.info({ imageSlug, key }, "[registry-gc] deleted orphaned blob")
      }
    }
  }

  // 7. Delete tag manifests for EXPIRED/PURGED images
  let manifestsDeleted = 0
  for (const tagKey of tagManifestKeys) {
    const tagName = tagKey.slice(manifestPrefix.length)
    if (tagsToDelete.has(tagName)) {
      const ok = await deleteRegistryKeyWithClient(s3Client, tagKey)
      if (ok) {
        manifestsDeleted++
        logger.info(
          { imageSlug, tagKey },
          "[registry-gc] deleted expired tag manifest"
        )
      }
    }
  }

  // 8. Delete orphaned digest-based manifests
  for (const digestKey of digestManifestKeys) {
    const digestName = digestKey.slice(manifestPrefix.length)
    if (!neededDigestManifests.has(digestName)) {
      const ok = await deleteRegistryKeyWithClient(s3Client, digestKey)
      if (ok) {
        manifestsDeleted++
        logger.info(
          { imageSlug, digestKey },
          "[registry-gc] deleted orphaned digest manifest"
        )
      }
    }
  }

  return {
    imageSlug,
    manifestsDeleted,
    blobsDeleted,
    skipped: false,
  }
}

/**
 * Run registry GC for all EXPIRED/PURGED images currently in DB across all clusters.
 */
export async function runRegistryGc(): Promise<RegistryGcJobResult> {
  const expiredStacks = await prisma.applicationContainerImage.findMany({
    where: {
      status: "EXPIRED",
      purgedAt: null,
    },
    select: {
      stackId: true,
    },
    distinct: ["stackId"],
  })

  const stackIds = expiredStacks.map((i) => i.stackId)
  const stacks = await prisma.applicationStack.findMany({
    where: { id: { in: stackIds } },
    select: { slug: true },
  })

  const slugs = stacks.map((s) => s.slug).filter(Boolean)

  logger.info(
    { slugs, count: slugs.length },
    "[registry-gc] starting GC for stacks with expired images"
  )

  const results: RegistryGcResult[] = []

  for (const slug of slugs) {
    try {
      const result = await gcRegistryImage(slug)
      results.push(result)
    } catch (err) {
      logger.error(
        { err, slug },
        "[registry-gc] unhandled error processing image"
      )
      results.push({
        imageSlug: slug,
        manifestsDeleted: 0,
        blobsDeleted: 0,
        skipped: true,
        skipReason: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  // Mark successfully GC'd images as PURGED in DB
  const gcSuccessSlugs = results
    .filter((r) => !r.skipped)
    .map((r) => r.imageSlug)

  if (gcSuccessSlugs.length > 0) {
    for (const slug of gcSuccessSlugs) {
      const stackRow = await prisma.applicationStack.findFirst({
        where: { slug },
        select: { id: true },
      })
      if (stackRow) {
        await prisma.applicationContainerImage.updateMany({
          where: {
            stackId: stackRow.id,
            status: "EXPIRED",
            purgedAt: null,
          },
          data: {
            status: "PURGED",
            purgedAt: new Date(),
          },
        })
      }
    }
  }

  const totalManifestsDeleted = results.reduce(
    (s, r) => s + r.manifestsDeleted,
    0
  )
  const totalBlobsDeleted = results.reduce((s, r) => s + r.blobsDeleted, 0)

  logger.info(
    { totalManifestsDeleted, totalBlobsDeleted, processedImages: slugs.length },
    "[registry-gc] GC run complete"
  )

  return {
    processedImages: slugs.length,
    totalManifestsDeleted,
    totalBlobsDeleted,
    results,
  }
}
