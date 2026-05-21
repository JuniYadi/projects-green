import { z } from "zod"

export const SUPPORT_TICKET_ATTACHMENT_ALLOWED_EXTENSIONS = [
  "csv",
  "jpeg",
  "jpg",
  "json",
  "log",
  "pdf",
  "png",
  "txt",
  "webp",
] as const

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

const DEFAULT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

const parseMaxFileSizeBytes = () => {
  const rawValue = process.env.SUPPORT_TICKET_ATTACHMENT_MAX_SIZE_BYTES?.trim()

  if (!rawValue) {
    return DEFAULT_MAX_FILE_SIZE_BYTES
  }

  const parsed = Number(rawValue)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_MAX_FILE_SIZE_BYTES
  }

  return parsed
}

export const SUPPORT_TICKET_ATTACHMENT_MAX_SIZE_BYTES = parseMaxFileSizeBytes()

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
  if (sizeBytes > SUPPORT_TICKET_ATTACHMENT_MAX_SIZE_BYTES) {
    throw new SupportTicketAttachmentValidationError(
      "FILE_TOO_LARGE",
      `Attachment exceeds ${SUPPORT_TICKET_ATTACHMENT_MAX_SIZE_BYTES} bytes.`
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
  if (!(extension in EXTENSION_MIME_ALLOWLIST)) {
    throw new SupportTicketAttachmentValidationError(
      "UNSUPPORTED_EXTENSION",
      "Attachment extension is not allowed."
    )
  }
}

const assertMimeMatchesExtension = (extension: string, mimeType: string) => {
  const allowedMimes = EXTENSION_MIME_ALLOWLIST[extension]

  if (!allowedMimes.includes(mimeType)) {
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
