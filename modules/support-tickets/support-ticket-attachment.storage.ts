import { randomUUID } from "node:crypto"

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export class SupportTicketAttachmentStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SupportTicketAttachmentStorageConfigurationError"
  }
}

export class SupportTicketAttachmentUploadNotFoundError extends Error {
  constructor() {
    super("Attachment upload was not found in storage.")
    this.name = "SupportTicketAttachmentUploadNotFoundError"
  }
}

export class SupportTicketAttachmentUploadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SupportTicketAttachmentUploadValidationError"
  }
}

const DEFAULT_PREFIX = "support-ticket-attachments"
const DEFAULT_PRESIGN_TTL_SECONDS = 300

const sanitizeSegment = (value: string) => {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "_")
}

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new SupportTicketAttachmentStorageConfigurationError(
      `Missing ${name} environment variable`
    )
  }

  return value
}

const getStoragePrefix = () => {
  const value = process.env.SUPPORT_TICKET_ATTACHMENT_S3_PREFIX?.trim()

  return value ? value.replace(/^\/+|\/+$/g, "") : DEFAULT_PREFIX
}

const getPresignTtlSeconds = () => {
  const rawValue = process.env.SUPPORT_TICKET_ATTACHMENT_PRESIGN_TTL_SECONDS

  if (!rawValue?.trim()) {
    return DEFAULT_PRESIGN_TTL_SECONDS
  }

  const parsed = Number(rawValue)

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 900) {
    return DEFAULT_PRESIGN_TTL_SECONDS
  }

  return parsed
}

type AttachmentStorageConfig = {
  bucket: string
  prefix: string
  presignTtlSeconds: number
  region: string
}

const loadStorageConfig = (): AttachmentStorageConfig => {
  return {
    bucket: getRequiredEnv("SUPPORT_TICKET_ATTACHMENT_S3_BUCKET"),
    region: getRequiredEnv("SUPPORT_TICKET_ATTACHMENT_S3_REGION"),
    prefix: getStoragePrefix(),
    presignTtlSeconds: getPresignTtlSeconds(),
  }
}

const createS3Client = (region: string) => {
  return new S3Client({ region })
}

export type SupportTicketAttachmentKeyContext = {
  extension: string
  organizationId: string
  ticketId: string
  uploaderWorkosUserId: string
}

export const buildSupportTicketAttachmentStoragePrefix = (
  context: Omit<SupportTicketAttachmentKeyContext, "extension">
) => {
  const config = loadStorageConfig()

  return [
    config.prefix,
    sanitizeSegment(context.organizationId),
    sanitizeSegment(context.ticketId),
    sanitizeSegment(context.uploaderWorkosUserId),
  ].join("/")
}

const buildSupportTicketAttachmentStorageKey = (
  context: SupportTicketAttachmentKeyContext
) => {
  const prefix = buildSupportTicketAttachmentStoragePrefix(context)
  const timestamp = Date.now()
  const randomSuffix = randomUUID().slice(0, 12)

  return `${prefix}/${timestamp}-${randomSuffix}.${context.extension}`
}

type CreatePresignedUploadInput = {
  attachmentId: string
  checksumSha256?: string | null
  extension: string
  fileName: string
  mimeType: string
  organizationId: string
  sizeBytes: number
  ticketId: string
  uploaderWorkosUserId: string
}

type VerifyUploadedObjectInput = {
  attachmentId: string
  checksumSha256?: string | null
  mimeType: string
  organizationId: string
  sizeBytes: number
  storageKey: string
  ticketId: string
  uploaderWorkosUserId: string
}

export type SupportTicketAttachmentStorage = {
  createPresignedUpload: (input: CreatePresignedUploadInput) => Promise<{
    bucket: string
    expiresAt: string
    key: string
    uploadUrl: string
  }>
  getExpectedStorageKeyPrefix: (context: {
    organizationId: string
    ticketId: string
    uploaderWorkosUserId: string
  }) => string
  verifyUploadedObject: (input: VerifyUploadedObjectInput) => Promise<void>
}

export const createSupportTicketAttachmentStorage =
  (): SupportTicketAttachmentStorage => {
    const config = loadStorageConfig()
    const s3 = createS3Client(config.region)

    return {
      async createPresignedUpload(input) {
        const key = buildSupportTicketAttachmentStorageKey({
          extension: input.extension,
          organizationId: input.organizationId,
          ticketId: input.ticketId,
          uploaderWorkosUserId: input.uploaderWorkosUserId,
        })

        const command = new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          ContentLength: input.sizeBytes,
          ContentType: input.mimeType,
          ChecksumSHA256: input.checksumSha256 ?? undefined,
          Metadata: {
            attachmentid: input.attachmentId,
            organizationid: input.organizationId,
            ticketid: input.ticketId,
            uploaderid: input.uploaderWorkosUserId,
            originalname: input.fileName,
          },
        })

        const uploadUrl = await getSignedUrl(s3, command, {
          expiresIn: config.presignTtlSeconds,
        })
        const expiresAt = new Date(
          Date.now() + config.presignTtlSeconds * 1000
        ).toISOString()

        return {
          bucket: config.bucket,
          key,
          uploadUrl,
          expiresAt,
        }
      },
      getExpectedStorageKeyPrefix(context) {
        return buildSupportTicketAttachmentStoragePrefix({
          organizationId: context.organizationId,
          ticketId: context.ticketId,
          uploaderWorkosUserId: context.uploaderWorkosUserId,
        })
      },
      async verifyUploadedObject(input) {
        try {
          const result = await s3.send(
            new HeadObjectCommand({
              Bucket: config.bucket,
              Key: input.storageKey,
            })
          )

          if (result.ContentLength !== input.sizeBytes) {
            throw new SupportTicketAttachmentUploadValidationError(
              "Uploaded attachment size does not match registration payload."
            )
          }

          if (result.ContentType !== input.mimeType) {
            throw new SupportTicketAttachmentUploadValidationError(
              "Uploaded attachment MIME type does not match registration payload."
            )
          }

          if (input.checksumSha256 && result.ChecksumSHA256) {
            if (result.ChecksumSHA256 !== input.checksumSha256) {
              throw new SupportTicketAttachmentUploadValidationError(
                "Uploaded attachment checksum does not match registration payload."
              )
            }
          }

          const metadata = result.Metadata ?? {}
          const metadataMatches =
            metadata.attachmentid === input.attachmentId &&
            metadata.organizationid === input.organizationId &&
            metadata.ticketid === input.ticketId &&
            metadata.uploaderid === input.uploaderWorkosUserId

          if (!metadataMatches) {
            throw new SupportTicketAttachmentUploadValidationError(
              "Uploaded attachment metadata does not match expected ownership."
            )
          }
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "$metadata" in error &&
            typeof (error as { $metadata?: { httpStatusCode?: number } })
              .$metadata?.httpStatusCode === "number" &&
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata
              ?.httpStatusCode === 404
          ) {
            throw new SupportTicketAttachmentUploadNotFoundError()
          }

          throw error
        }
      },
    }
  }
