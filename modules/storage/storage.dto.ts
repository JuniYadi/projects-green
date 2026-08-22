import { z } from "zod"
import type { StorageFile } from "@prisma/client"

// Standard MIME type regex (e.g. image/png, application/pdf, video/mp4)
const MIME_TYPE_REGEX =
  /^[a-zA-Z0-9][-a-zA-Z0-9_.]*\/[a-zA-Z0-9][-a-zA-Z0-9_.+]*$/

// Filename regex requiring valid filename and extension, allowing spaces, dots, timestamps (e.g. Screenshot 2026-08-22 at 03.45.08.png)
const FILENAME_REGEX = /^.+\.[a-zA-Z0-9]{1,10}$/

export const PresignUploadRequestSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(3, "Filename must be at least 3 characters")
    .max(255, "Filename cannot exceed 255 characters")
    .regex(
      FILENAME_REGEX,
      "Filename must include a valid file name and extension (e.g. image.png, doc.pdf)"
    ),
  mimeType: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(
      MIME_TYPE_REGEX,
      "Invalid MIME type format (e.g. image/png, application/pdf)"
    ),
  sizeBytes: z.number().int().nonnegative().optional(),
  purpose: z.string().max(50).default("whatsapp"),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type PresignUploadRequest = z.infer<typeof PresignUploadRequestSchema>

export interface PresignUploadResponseDTO {
  fileId: string
  storageKey: string
  uploadUrl: string
  expiresAt: string
  purpose: string
  headers: Record<string, string>
}

export const ConfirmUploadRequestSchema = z.object({
  fileId: z.string().min(1),
  storageKey: z.string().min(1).optional(),
  sizeBytes: z.number().int().positive().optional(),
  publicUrl: z.string().url().optional(),
})

export type ConfirmUploadRequest = z.infer<typeof ConfirmUploadRequestSchema>

export interface StorageFileDTO {
  id: string
  organizationId: string
  uploadedByUserId: string | null
  purpose: string
  bucket: string
  storageKey: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  status: string
  publicUrl: string | null
  metadata: Record<string, unknown> | null
  expiresAt: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
}

export function toStorageFileDTO(file: StorageFile): StorageFileDTO {
  return {
    id: file.id,
    organizationId: file.organizationId,
    uploadedByUserId: file.uploadedByUserId,
    purpose: file.purpose,
    bucket: file.bucket,
    storageKey: file.storageKey,
    originalFilename: file.originalFilename,
    mimeType: file.mimeType,
    sizeBytes: Number(file.sizeBytes),
    status: file.status,
    publicUrl: file.publicUrl,
    metadata: (file.metadata as Record<string, unknown>) || null,
    expiresAt: file.expiresAt ? file.expiresAt.toISOString() : null,
    confirmedAt: file.confirmedAt ? file.confirmedAt.toISOString() : null,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  }
}

export interface StorageMetricsDTO {
  totalFiles: number
  totalBytes: number
  activeFiles: number
  pendingFiles: number
  deletedFiles: number
  purposeBreakdown: Array<{
    purpose: string
    count: number
    totalBytes: number
  }>
}
