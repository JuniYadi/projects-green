import { Prisma } from "@prisma/client"
import type { ExpiryStatus } from "./media.service"

export type MediaDTO = Pick<
  Prisma.WhatsappMediaGetPayload<{}>,
  | "id"
  | "organizationId"
  | "deviceId"
  | "metaMediaId"
  | "mimeType"
  | "fileSize"
  | "sha256"
  | "downloadedAt"
  | "expiresAt"
  | "createdAt"
> & { expiryStatus: ExpiryStatus; storePath?: string | null }

export function toMediaDTO(
  record: Prisma.WhatsappMediaGetPayload<{}>
): MediaDTO {
  return {
    id: record.id,
    organizationId: record.organizationId,
    deviceId: record.deviceId,
    metaMediaId: record.metaMediaId,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    sha256: record.sha256,
    downloadedAt: record.downloadedAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    expiryStatus: "green",
    storePath: record.storePath,
  }
}
