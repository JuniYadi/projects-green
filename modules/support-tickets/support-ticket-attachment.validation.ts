import { z } from "zod"

const EXTENSION_MIME_ALLOWLIST: Record<string, readonly string[]> = {
  csv: ["text/csv", "application/csv"],
  jpeg: ["image/jpeg"],
  jpg: ["image/jpeg"],
  json: ["application/json", "text/json"],
  log: ["text/plain", "text/x-log"],
  pdf: ["application/pdf"],
  png: ["image/png"],
  txt: ["text/plain"],
  webp: ["image/webp"],
}

const DEFAULT_ALLOWED_EXTENSIONS = Object.keys(EXTENSION_MIME_ALLOWLIST).sort()
const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export const S3_ATTACHMENT_ALLOWED_MIME_TYPES: readonly string[] = [
  ...new Set(Object.values(EXTENSION_MIME_ALLOWLIST).flat()),
]

const parseAllowedExtensions = () => {
  const rawValue = process.env.S3_ATTACHMENT_ALLOWED_EXTENSIONS?.trim()

  if (!rawValue) {
    return DEFAULT_ALLOWED_EXTENSIONS
  }

  const parsed = rawValue
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  if (!parsed.length) {
    return DEFAULT_ALLOWED_EXTENSIONS
  }

  const normalized = [...new Set(parsed)].filter((item) => {
    return item in EXTENSION_MIME_ALLOWLIST
  })

  if (!normalized.length) {
    return DEFAULT_ALLOWED_EXTENSIONS
  }

  return normalized
}

const parseMaxFileSizeBytes = () => {
  const rawValue = process.env.S3_ATTACHMENT_MAX_SIZE_BYTES?.trim()

  if (!rawValue) {
    return DEFAULT_MAX_FILE_SIZE_BYTES
  }

  const parsed = Number(rawValue)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_MAX_FILE_SIZE_BYTES
  }

  return parsed
}

export const S3_ATTACHMENT_ALLOWED_EXTENSIONS = parseAllowedExtensions()

export const S3_ATTACHMENT_MAX_SIZE_BYTES = parseMaxFileSizeBytes()

export type SupportTicketAttachmentValidationCode =
  | "UNSUPPORTED_EXTENSION"
  | "FILE_TOO_LARGE"
  | "INVALID_MIME_TYPE"
  | "MIME_EXTENSION_MISMATCH"

export class SupportTicketAttachmentValidationError extends Error {
  readonly code: SupportTicketAttachmentValidationCode

  constructor(code: SupportTicketAttachmentValidationCode, message: string) {
    super(message)
    this.name = "SupportTicketAttachmentValidationError"
    this.code = code
  }
}

export const supportTicketAttachmentUploadInputSchema = z.object({
  checksumSha256: z.string().trim().min(1).nullable().optional(),
  fileName: z.string().trim().min(1, "fileName is required."),
  mimeType: z.string().trim().min(1, "mimeType is required."),
  sizeBytes: z
    .number()
    .int("sizeBytes must be an integer")
    .positive("sizeBytes must be greater than 0"),
})

const normalizeMimeType = (value: string) => {
  return value.trim().toLowerCase()
}

const getFileExtension = (fileName: string) => {
  const value = fileName.trim()
  const extensionIndex = value.lastIndexOf(".")

  if (extensionIndex <= 0 || extensionIndex === value.length - 1) {
    throw new SupportTicketAttachmentValidationError(
      "UNSUPPORTED_EXTENSION",
      "Attachment file extension is required and must be supported."
    )
  }

  return value.slice(extensionIndex + 1).toLowerCase()
}

const assertFileSizeAllowed = (sizeBytes: number) => {
  if (sizeBytes > S3_ATTACHMENT_MAX_SIZE_BYTES) {
    throw new SupportTicketAttachmentValidationError(
      "FILE_TOO_LARGE",
      `Attachment exceeds ${S3_ATTACHMENT_MAX_SIZE_BYTES} bytes.`
    )
  }
}

const assertMimeTypeAllowed = (mimeType: string) => {
  const normalizedMime = normalizeMimeType(mimeType)

  if (!normalizedMime.includes("/")) {
    throw new SupportTicketAttachmentValidationError(
      "INVALID_MIME_TYPE",
      "Attachment MIME type must be a valid media type."
    )
  }

  return normalizedMime
}

const assertExtensionAllowed = (extension: string) => {
  if (!S3_ATTACHMENT_ALLOWED_EXTENSIONS.includes(extension)) {
    throw new SupportTicketAttachmentValidationError(
      "UNSUPPORTED_EXTENSION",
      "Attachment extension is not allowed."
    )
  }
}

const assertMimeMatchesExtension = (extension: string, mimeType: string) => {
  const allowedMimes = EXTENSION_MIME_ALLOWLIST[extension]

  if (!allowedMimes?.includes(mimeType)) {
    throw new SupportTicketAttachmentValidationError(
      "MIME_EXTENSION_MISMATCH",
      "Attachment MIME type does not match its extension allowlist."
    )
  }
}

export const validateSupportTicketAttachmentUploadInput = (
  input: z.input<typeof supportTicketAttachmentUploadInputSchema>
) => {
  const parsed = supportTicketAttachmentUploadInputSchema.parse(input)
  const extension = getFileExtension(parsed.fileName)

  assertExtensionAllowed(extension)
  assertFileSizeAllowed(parsed.sizeBytes)

  const mimeType = assertMimeTypeAllowed(parsed.mimeType)
  assertMimeMatchesExtension(extension, mimeType)

  return {
    ...parsed,
    fileName: parsed.fileName.trim(),
    mimeType,
    extension,
  }
}

export const isAllowedSupportTicketAttachmentStorageKey = (
  storageKey: string,
  expectedPrefix: string
) => {
  const key = storageKey.trim()

  return key.startsWith(expectedPrefix)
}
