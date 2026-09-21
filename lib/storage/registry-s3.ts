import { S3Client } from "bun"
import { logger } from "@/lib/logger"

export interface RegistryS3Config {
  endpoint?: string
  bucket: string
  accessKeyId?: string
  secretAccessKey?: string
  region?: string
}

export function createRegistryS3Client(config: RegistryS3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region ?? "auto",
  })
}

/**
 * List all keys under a prefix using a provided S3Client instance.
 */
export async function listAllKeysWithClient(
  client: S3Client,
  prefix: string
): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const res = await client.list({
      prefix,
      maxKeys: 1000,
      continuationToken,
    })

    for (const obj of res.contents ?? []) {
      if (obj.key) keys.push(obj.key)
    }

    continuationToken = res.isTruncated ? res.nextContinuationToken : undefined
  } while (continuationToken)

  return keys
}

/**
 * Delete a single key from the registry bucket using a provided S3Client instance.
 */
export async function deleteRegistryKeyWithClient(
  client: S3Client,
  key: string
): Promise<boolean> {
  try {
    await client.file(key).delete()
    return true
  } catch (err) {
    logger.warn(
      { err, key },
      "[registry-s3] failed to delete key from registry bucket"
    )
    return false
  }
}

/**
 * Read and parse a manifest JSON from the registry bucket using a provided S3Client instance.
 */
export async function readManifestJsonWithClient(
  client: S3Client,
  key: string
): Promise<Record<string, unknown> | null> {
  try {
    const file = client.file(key)
    const text = await file.text()
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}
