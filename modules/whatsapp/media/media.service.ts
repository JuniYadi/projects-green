import { prisma } from "@/lib/prisma"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import fs from "node:fs"
import path from "node:path"

const STORAGE_BASE = path.join(process.cwd(), "storage", "whatsapp", "media")
const EXPIRY_DAYS = 30
// ponytail: local FS, S3 when there's actual traffic pressure

export type ExpiryStatus = "green" | "yellow" | "red"

export async function uploadAndSave(
  deviceId: string,
  organizationId: string,
  file: ArrayBuffer,
  fileName: string,
  mimeType: string
) {
  const device = await prisma.whatsappDevice.findUniqueOrThrow({
    where: { id: deviceId },
  })

  const client = await WhatsAppDeviceClient.fromDevice({
    accessToken: device.tokenEncrypted ?? "",
    phoneNumberId: device.whatsappPhoneId ?? "",
    wabaId: device.whatsappBusinessAccountId ?? "",
    organizationId,
  })

  const { mediaId } = await client.completeUploadMedia(file, fileName, mimeType)

  const dir = path.join(STORAGE_BASE, deviceId, mediaId)
  fs.mkdirSync(dir, { recursive: true })
  const storePath = path.join(dir, `${mediaId}`)
  // ponytail: store as mediaId (not fileName) so upload/download share one path pattern
  fs.writeFileSync(storePath, Buffer.from(file))

  let record
  try {
    record = await prisma.whatsappMedia.create({
      data: {
        organizationId,
        deviceId,
        metaMediaId: mediaId,
        mimeType,
        fileSize: file.byteLength,
        storePath,
        downloadedAt: new Date(),
        expiresAt: new Date(Date.now() + EXPIRY_DAYS * 86_400_000),
      },
    })
  } catch (e) {
    // ponytail: cleanup dir if DB create fails after Meta upload succeeds
    fs.rmSync(dir, { recursive: true, force: true })
    throw e
  }

  return record
}

export async function getMetadata(mediaId: string) {
  let record = await prisma.whatsappMedia.findUnique({
    where: { id: mediaId },
  })
  if (!record) {
    record = await prisma.whatsappMedia.findUnique({
      where: { metaMediaId: mediaId },
    })
  }
  return record ?? null
}

export async function downloadAndSave(
  deviceId: string,
  organizationId: string,
  mediaId: string
) {
  let existing = await prisma.whatsappMedia.findUnique({
    where: { id: mediaId },
  })
  if (!existing) {
    existing = await prisma.whatsappMedia.findUnique({
      where: { metaMediaId: mediaId },
    })
  }
  if (existing?.storePath && fs.existsSync(existing.storePath)) {
    return existing
  }

  const device = await prisma.whatsappDevice.findUniqueOrThrow({
    where: { id: deviceId },
  })

  const client = await WhatsAppDeviceClient.fromDevice({
    accessToken: device.tokenEncrypted ?? "",
    phoneNumberId: device.whatsappPhoneId ?? "",
    wabaId: device.whatsappBusinessAccountId ?? "",
    organizationId,
  })

  const metaMediaId = existing?.metaMediaId ?? mediaId

  const meta = await client.getMedia(metaMediaId)
  const binary = await client.downloadMedia(metaMediaId)

  const dir = path.join(STORAGE_BASE, deviceId, metaMediaId)
  fs.mkdirSync(dir, { recursive: true })
  const storePath = path.join(dir, `${metaMediaId}`)
  fs.writeFileSync(storePath, Buffer.from(binary))

  const key = existing ? { id: existing.id } : { metaMediaId }
  const record = await prisma.whatsappMedia.upsert({
    where: key,
    create: {
      organizationId,
      deviceId,
      metaMediaId,
      mimeType: meta.mime_type,
      fileSize: binary.byteLength,
      sha256: meta.sha256,
      storePath,
      downloadedAt: new Date(),
      expiresAt: new Date(Date.now() + EXPIRY_DAYS * 86_400_000),
    },
    update: {
      mimeType: meta.mime_type,
      fileSize: binary.byteLength,
      sha256: meta.sha256,
      storePath,
      downloadedAt: new Date(),
      expiresAt: new Date(Date.now() + EXPIRY_DAYS * 86_400_000),
    },
  })

  return record
}

export async function deleteLocal(mediaId: string) {
  let record = await prisma.whatsappMedia.findUnique({
    where: { id: mediaId },
  })
  if (!record) {
    record = await prisma.whatsappMedia.findUnique({
      where: { metaMediaId: mediaId },
    })
  }
  if (!record) return

  if (record.storePath) {
    const dir = path.dirname(record.storePath)
    fs.rmSync(dir, { recursive: true, force: true })
  }

  await prisma.whatsappMedia.delete({ where: { id: record.id } })
}

export function isExpired(record: { expiresAt: Date | null }): boolean {
  if (!record.expiresAt) return false
  return record.expiresAt.getTime() <= Date.now()
}

export function expiryStatus(record: {
  expiresAt: Date | null
  downloadedAt: Date | null
}): ExpiryStatus {
  if (!record.downloadedAt || !record.expiresAt) return "red"
  const daysLeft =
    (record.expiresAt.getTime() - Date.now()) / 86_400_000
  if (daysLeft > 5) return "green"
  if (daysLeft > 0) return "yellow"
  return "red"
}

export function getStoragePath(
  record: { storePath: string | null; metaMediaId: string; deviceId: string },
  fallbackFileName?: string
): string | null {
  if (record.storePath && fs.existsSync(record.storePath)) {
    return record.storePath
  }
  // ponytail: check for the fallback path pattern used by downloadAndSave
  const fallback = path.join(
    STORAGE_BASE,
    record.deviceId,
    record.metaMediaId,
    fallbackFileName ?? record.metaMediaId
  )
  if (fs.existsSync(fallback)) return fallback
  return null
}

export async function listMedia(
  organizationId: string,
  deviceId?: string
) {
  const where: Record<string, unknown> = { organizationId }
  if (deviceId) where.deviceId = deviceId

  return prisma.whatsappMedia.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })
}
