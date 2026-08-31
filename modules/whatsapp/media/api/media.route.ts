import { Elysia, t } from "elysia"
import { prisma } from "@/lib/prisma"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"
import { WhatsAppDeviceClient } from "@/lib/whatsapp/meta-cloud/device-client"
import { toMediaDTO } from "../media.dto"
import {
  uploadAndSave,
  downloadAndSave,
  deleteLocal,
  getMetadata,
  listMedia,
  expiryStatus,
  getStoragePath,
} from "../media.service"
import {
  SUPPORTED_MIME_TYPES,
  MIME_SIZE_LIMITS,
  mimeCategory,
} from "../whatsapp-media.validator"
import fs from "node:fs"

export const mediaRoutes = new Elysia({
  prefix: "/media",
  detail: {
    tags: ["WhatsApp Media"],
  },
})
  // POST / — upload file to Meta + store locally
  .post(
    "/",
    async ({ request, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required.",
        }
      }

      const contentType = request.headers.get("content-type") ?? ""
      if (!contentType.includes("multipart/form-data")) {
        set.status = 400
        return {
          ok: false,
          error: "BAD_REQUEST",
          message: "Expected multipart/form-data.",
        }
      }

      const formData = await request.formData()
      const file = formData.get("file") as File | null
      const deviceId = formData.get("deviceId") as string | null

      if (!file || !deviceId) {
        set.status = 400
        return {
          ok: false,
          error: "VALIDATION_ERROR",
          message: "file and deviceId are required.",
        }
      }

      if (!SUPPORTED_MIME_TYPES.includes(file.type as any)) {
        set.status = 400
        return {
          ok: false,
          error: "UNSUPPORTED_MEDIA_TYPE",
          message: `Unsupported media type: ${file.type}`,
        }
      }

      const category = mimeCategory(file.type)
      const limit = MIME_SIZE_LIMITS[category] ?? 16 * 1024 * 1024
      if (file.size > limit) {
        set.status = 400
        return {
          ok: false,
          error: "FILE_TOO_LARGE",
          message: `File exceeds ${category} size limit of ${Math.round(limit / 1024 / 1024)}MB.`,
        }
      }

      // Verify device belongs to org
      const device = await prisma.whatsappDevice.findFirst({
        where: { id: deviceId, organizationId: auth.organizationId },
      })
      if (!device) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Device not found." }
      }

      const buffer = await file.arrayBuffer()
      const record = await uploadAndSave(
        deviceId,
        auth.organizationId,
        buffer,
        file.name,
        file.type
      )
      return { ok: true, media: toMediaDTO(record) }
    },
    {
      detail: {
        summary: "Upload Media to Meta Cloud API",
        description:
          "Uploads a media file (image, document, audio, video) to WhatsApp Cloud API and persists a local media record.",
        tags: ["WhatsApp Media"],
      },
    }
  )

  // GET / — list media
  .get(
    "/",
    async ({ request, query, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required.",
        }
      }

      const records = await listMedia(
        auth.organizationId,
        query.deviceId ?? undefined
      )
      return {
        ok: true,
        media: records.map((r) => ({
          ...toMediaDTO(r),
          expiryStatus: expiryStatus(r),
        })),
      }
    },
    {
      query: t.Object({
        deviceId: t.Optional(
          t.String({
            example: "dev_clt1234567890",
            description: "Filter by WhatsApp device ID",
          })
        ),
      }),
      detail: {
        summary: "List Uploaded Media Files",
        description:
          "Retrieves media files stored for the active organization with retention expiry status.",
        tags: ["WhatsApp Media"],
      },
    }
  )

  // GET /:id — metadata
  .get(
    "/:id",
    async ({ request, params: { id }, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required.",
        }
      }

      const record = await getMetadata(id)
      if (!record) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Media not found." }
      }

      if (record.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      return {
        ok: true,
        media: { ...toMediaDTO(record), expiryStatus: expiryStatus(record) },
      }
    },
    {
      params: t.Object({
        id: t.String({
          example: "med_clt1234567890",
          description: "Media record ID",
        }),
      }),
      detail: {
        summary: "Get Media File Metadata",
        description:
          "Returns metadata, MIME type, file size, and Meta media ID for a stored media item.",
        tags: ["WhatsApp Media"],
      },
    }
  )

  // DELETE /:id — delete from Meta + local
  .delete(
    "/:id",
    async ({ request, params: { id }, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required.",
        }
      }

      const record = await getMetadata(id)
      if (!record) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Media not found." }
      }

      if (record.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      const device = await prisma.whatsappDevice.findUniqueOrThrow({
        where: { id: record.deviceId },
      })
      const client = await WhatsAppDeviceClient.fromDevice({
        accessToken: device.tokenEncrypted ?? "",
        phoneNumberId: device.whatsappPhoneId ?? "",
        wabaId: device.whatsappBusinessAccountId ?? "",
        organizationId: auth.organizationId,
      })
      await client.deleteMedia(record.metaMediaId)

      await deleteLocal(id)
      return { ok: true }
    },
    {
      params: t.Object({
        id: t.String({
          example: "med_clt1234567890",
          description: "Media record ID",
        }),
      }),
      detail: {
        summary: "Delete Media File",
        description:
          "Deletes a media asset from Meta servers and removes local file copies.",
        tags: ["WhatsApp Media"],
      },
    }
  )

  // GET /:id/download — stream binary
  .get(
    "/:id/download",
    async ({ request, params: { id }, query, set }: any) => {
      const auth = await resolveAuthContext(request)
      if (!auth) {
        set.status = 401
        return { ok: false, error: "UNAUTHORIZED", message: "Auth required." }
      }
      if (!auth.organizationId) {
        set.status = 403
        return {
          ok: false,
          error: "FORBIDDEN",
          message: "Organization required.",
        }
      }

      let record = await getMetadata(id)
      if (!record) {
        set.status = 404
        return { ok: false, error: "NOT_FOUND", message: "Media not found." }
      }

      if (record.organizationId !== auth.organizationId) {
        set.status = 403
        return { ok: false, error: "FORBIDDEN", message: "Access denied." }
      }

      // Try local storage first, fall back to download from Meta
      let storePath = getStoragePath(record)
      if (!storePath) {
        record = await downloadAndSave(
          record.deviceId,
          record.organizationId,
          record.metaMediaId
        )
        storePath = getStoragePath(record)
      }

      if (!storePath || !fs.existsSync(storePath)) {
        set.status = 404
        return {
          ok: false,
          error: "NOT_FOUND",
          message: "File not available on disk.",
        }
      }

      const stat = fs.statSync(storePath)
      const fileName = storePath.split("/").pop() ?? "download"

      // Determine disposition:
      // If query ?download=true is explicitly passed, force attachment download.
      // Otherwise, for images, stickers, audio, video, and PDF, default to "inline"
      // so browser <img> tags and media players render directly without triggering save dialogs.
      const isMediaPreview =
        record.mimeType.startsWith("image/") ||
        record.mimeType.startsWith("audio/") ||
        record.mimeType.startsWith("video/") ||
        record.mimeType === "application/pdf"

      const dispositionType =
        query?.download === "true" || !isMediaPreview ? "attachment" : "inline"

      // ponytail: streaming via blob — fs.createReadStream is cleanest but Elysia
      // handles blob well enough for this payload size
      const blob = new Blob([fs.readFileSync(storePath)], {
        type: record.mimeType,
      })

      return new Response(blob, {
        status: 200,
        headers: {
          "Content-Type": record.mimeType,
          "Content-Disposition": `${dispositionType}; filename="${fileName}"`,
          "Content-Length": String(stat.size),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      })
    },
    {
      params: t.Object({
        id: t.String({
          example: "med_clt1234567890",
          description: "Media record ID",
        }),
      }),
      query: t.Optional(
        t.Object({
          download: t.Optional(
            t.String({
              example: "true",
              description:
                "Force attachment download instead of inline preview",
            })
          ),
        })
      ),
      detail: {
        summary: "Download / Preview Media Content",
        description:
          "Streams binary content of a stored WhatsApp media file with inline preview for images/audio/stickers or attachment on download.",
        tags: ["WhatsApp Media"],
      },
    }
  )
