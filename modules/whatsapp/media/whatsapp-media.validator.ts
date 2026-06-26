export const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "video/mp4",
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "text/plain",
  "application/pdf",
] as const

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number]

export const MIME_SIZE_LIMITS: Record<string, number> = {
  image: 5 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
}

export function mimeCategory(mime: string): string {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("video/")) return "video"
  return "document"
}
