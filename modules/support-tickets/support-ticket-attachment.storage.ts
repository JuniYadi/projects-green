import { randomUUID } from "node:crypto"

import type { SupportTicketAttachmentUploadTarget } from "@/modules/support-tickets/support-ticket.types"

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
  accessKeyId?: string
  bucket: string
  endpoint?: string
  prefix: string
  presignTtlSeconds: number
  region: string
  secretAccessKey?: string
  sessionToken?: string
  virtualHostedStyle?: boolean
}

const getOptionalEnv = (name: string) => {
  const value = process.env[name]?.trim()

  return value || undefined
}

const loadStorageConfig = (): AttachmentStorageConfig => {
  const virtualHostedStyle =
    process.env.SUPPORT_TICKET_ATTACHMENT_S3_VIRTUAL_HOSTED_STYLE?.trim()

  return {
    accessKeyId: getOptionalEnv("SUPPORT_TICKET_ATTACHMENT_S3_ACCESS_KEY_ID"),
    bucket: getRequiredEnv("SUPPORT_TICKET_ATTACHMENT_S3_BUCKET"),
    endpoint: getOptionalEnv("SUPPORT_TICKET_ATTACHMENT_S3_ENDPOINT"),
    region: getRequiredEnv("SUPPORT_TICKET_ATTACHMENT_S3_REGION"),
    prefix: getStoragePrefix(),
    presignTtlSeconds: getPresignTtlSeconds(),
    secretAccessKey: getOptionalEnv(
      "SUPPORT_TICKET_ATTACHMENT_S3_SECRET_ACCESS_KEY"
    ),
    sessionToken: getOptionalEnv("SUPPORT_TICKET_ATTACHMENT_S3_SESSION_TOKEN"),
    virtualHostedStyle:
      virtualHostedStyle === undefined
        ? undefined
        : ["1", "true", "yes", "on"].includes(virtualHostedStyle.toLowerCase()),
  }
}

export type SupportTicketAttachmentKeyContext = {
  extension: string
  organizationId: string
  target: SupportTicketAttachmentUploadTarget
  ticketId: string | null
  uploaderWorkosUserId: string
}

export const buildSupportTicketAttachmentStoragePrefix = (
  context: Omit<SupportTicketAttachmentKeyContext, "extension">
) => {
  const config = loadStorageConfig()
  const ticketScope = context.ticketId ? sanitizeSegment(context.ticketId) : "pending"

  return [
    config.prefix,
    sanitizeSegment(context.organizationId),
    sanitizeSegment(context.target),
    ticketScope,
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
  target: SupportTicketAttachmentUploadTarget
  ticketId: string | null
  uploaderWorkosUserId: string
}

type VerifyUploadedObjectInput = {
  attachmentId: string
  checksumSha256?: string | null
  mimeType: string
  organizationId: string
  sizeBytes: number
  storageKey: string
  target: SupportTicketAttachmentUploadTarget
  ticketId: string | null
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
    target: SupportTicketAttachmentUploadTarget
    ticketId: string | null
    uploaderWorkosUserId: string
  }) => string
  verifyUploadedObject: (input: VerifyUploadedObjectInput) => Promise<void>
}

export const createSupportTicketAttachmentStorage =
  (): SupportTicketAttachmentStorage => {
    const config = loadStorageConfig()
    const s3 = new Bun.S3Client({
      bucket: config.bucket,
      region: config.region,
      endpoint: config.endpoint,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken,
      virtualHostedStyle: config.virtualHostedStyle,
    })

    return {
      async createPresignedUpload(input) {
        const key = buildSupportTicketAttachmentStorageKey({
          extension: input.extension,
          organizationId: input.organizationId,
          target: input.target,
          ticketId: input.ticketId,
          uploaderWorkosUserId: input.uploaderWorkosUserId,
        })

        const uploadUrl = s3.presign(key, {
          method: "PUT",
          expiresIn: config.presignTtlSeconds,
          type: input.mimeType,
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
          target: context.target,
          ticketId: context.ticketId,
          uploaderWorkosUserId: context.uploaderWorkosUserId,
        })
      },
      async verifyUploadedObject(input) {
        try {
          const file = s3.file(input.storageKey)
          const exists = await file.exists()

          if (!exists) {
            throw new SupportTicketAttachmentUploadNotFoundError()
          }

          const result = await file.stat()

          if (result.size !== input.sizeBytes) {
            throw new SupportTicketAttachmentUploadValidationError(
              "Uploaded attachment size does not match registration payload."
            )
          }

          if (result.type !== input.mimeType) {
            throw new SupportTicketAttachmentUploadValidationError(
              "Uploaded attachment MIME type does not match registration payload."
            )
          }
        } catch (error) {
          throw error
        }
      },
    }
  }
