import { S3Client } from "bun"
import { encryptTenantStoragePath, decryptTenantStoragePath } from "../crypto"

export interface S3StorageConfig {
  bucket: string
  endpoint?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  publicUrlPrefix?: string
}

let s3ClientInstance: S3Client | null = null

export function getS3Config(): S3StorageConfig {
  const bucket =
    process.env.S3_BUCKET ||
    process.env.AWS_BUCKET_NAME ||
    "projects-green-storage"
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT
  const region =
    process.env.S3_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1"
  const accessKeyId =
    process.env.S3_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    "mock-access-key"
  const secretAccessKey =
    process.env.S3_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    "mock-secret-key"
  const publicUrlPrefix = process.env.S3_PUBLIC_URL_PREFIX

  return {
    bucket,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    publicUrlPrefix,
  }
}

export function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    const config = getS3Config()
    s3ClientInstance = new S3Client({
      bucket: config.bucket,
      endpoint: config.endpoint,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    })
  }
  return s3ClientInstance
}

/**
 * Generate standard isolated S3 Key:
 * {CompactFlatHex}/{YYYY}/{MM}/{cuid}_{sanitized_filename}.{ext}
 */
export function buildS3StorageKey(params: {
  organizationId: string
  fileId: string
  filename: string
  now?: Date
}): string {
  const now = params.now || new Date()
  const year = now.getUTCFullYear().toString()
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0")

  const flatHex = encryptTenantStoragePath(params.organizationId)
  const sanitizedFilename =
    params.filename
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "_")
      .replace(/^_+|_+$/g, "") || "file"

  return `${flatHex}/${year}/${month}/${params.fileId}_${sanitizedFilename}`
}

/**
 * Extracts and decrypts organizationId from an S3 storage key.
 */
export function extractOrganizationIdFromS3Key(storageKey: string): string {
  const parts = storageKey.split("/")
  if (parts.length < 4) {
    throw new Error("Invalid storage key structure")
  }
  const flatHex = parts[0]
  return decryptTenantStoragePath(flatHex)
}

/**
 * Presigns PUT upload URL with 15-minute default TTL (900 seconds)
 */
export async function getPresignedPutUrl(params: {
  storageKey: string
  mimeType: string
  expiresInSeconds?: number
}): Promise<string> {
  const client = getS3Client()
  const s3File = client.file(params.storageKey, {
    type: params.mimeType,
  })

  return s3File.presign({
    method: "PUT",
    expiresIn: params.expiresInSeconds || 900,
  })
}

/**
 * Presigns GET view/download URL with 15-minute default TTL (900 seconds)
 */
export async function getPresignedGetUrl(params: {
  storageKey: string
  expiresInSeconds?: number
}): Promise<string> {
  const client = getS3Client()
  const s3File = client.file(params.storageKey)

  return s3File.presign({
    method: "GET",
    expiresIn: params.expiresInSeconds || 900,
  })
}

/**
 * Check if object exists and retrieve metadata/size
 */
export async function statStorageFile(storageKey: string): Promise<{
  exists: boolean
  size: number
  type?: string
  lastModified?: Date
}> {
  const client = getS3Client()
  const s3File = client.file(storageKey)

  try {
    const exists = await s3File.exists()
    if (!exists) {
      return { exists: false, size: 0 }
    }
    const stat = await s3File.stat()
    return {
      exists: true,
      size: stat.size,
      type: stat.type,
      lastModified: stat.lastModified ? new Date(stat.lastModified) : undefined,
    }
  } catch (error) {
    // In local / mock environments, fallback gracefully
    return { exists: false, size: 0 }
  }
}

/**
 * Delete object from S3
 */
export async function deleteStorageFile(storageKey: string): Promise<boolean> {
  const client = getS3Client()
  const s3File = client.file(storageKey)
  try {
    await s3File.delete()
    return true
  } catch (error) {
    console.error("Failed to delete S3 file:", storageKey, error)
    return false
  }
}
