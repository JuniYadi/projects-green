import { Elysia, t } from "elysia"
import { StorageService } from "../storage.service"
import {
  PresignUploadRequestSchema,
  ConfirmUploadRequestSchema,
} from "../storage.dto"
import { resolveAuthContext } from "@/lib/auth/resolve-proxy-auth"

export const storageS3Routes = new Elysia({
  prefix: "/storage/s3",
  detail: {
    tags: ["S3 Presigned Storage"],
  },
})
  /**
   * POST /api/storage/s3/presign
   */
  .post(
    "/presign",
    async ({ body, set, request }) => {
      const auth = await resolveAuthContext(request)
      const organizationId = auth?.organizationId ?? null

      if (!auth || !organizationId) {
        set.status = 401
        return { error: "Unauthorized: Missing active organization session" }
      }

      const parsed = PresignUploadRequestSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return { error: "Validation error", details: parsed.error.format() }
      }

      try {
        const userId = auth.type === "workos" ? auth.userId : undefined
        const result = await StorageService.createPresignedUpload({
          organizationId,
          userId,
          input: parsed.data,
        })
        return result
      } catch (err: unknown) {
        set.status = 500
        const msg = err instanceof Error ? err.message : String(err)
        return { error: msg }
      }
    },
    {
      detail: {
        summary: "Initialize S3 Presigned Upload Session",
        description:
          "Generates a 15-minute presigned PUT URL with tenant HKDF path encryption and records a PENDING storage file entry.",
      },
      body: t.Object({
        filename: t.String({ description: "Original filename" }),
        mimeType: t.String({
          description: "MIME type (e.g. image/png, application/pdf)",
        }),
        sizeBytes: t.Optional(t.Number({ description: "File size in bytes" })),
        purpose: t.Optional(
          t.String({
            description: "Purpose tag (e.g. whatsapp, avatar)",
            default: "whatsapp",
          })
        ),
        metadata: t.Optional(t.Record(t.String(), t.Any())),
      }),
      response: {
        200: t.Object({
          fileId: t.String(),
          storageKey: t.String(),
          uploadUrl: t.String(),
          expiresAt: t.String(),
          purpose: t.String(),
          headers: t.Record(t.String(), t.String()),
        }),
        400: t.Object({ error: t.String(), details: t.Optional(t.Any()) }),
        401: t.Object({ error: t.String() }),
        500: t.Object({ error: t.String() }),
      },
    }
  )
  /**
   * POST /api/storage/s3/confirm
   */
  .post(
    "/confirm",
    async ({ body, set, request }) => {
      const auth = await resolveAuthContext(request)
      const organizationId = auth?.organizationId ?? null

      if (!auth || !organizationId) {
        set.status = 401
        return { error: "Unauthorized: Missing active organization session" }
      }

      const parsed = ConfirmUploadRequestSchema.safeParse(body)
      if (!parsed.success) {
        set.status = 400
        return { error: "Validation error", details: parsed.error.format() }
      }

      try {
        const result = await StorageService.confirmUpload({
          organizationId,
          input: parsed.data,
        })
        return result
      } catch (err: unknown) {
        set.status = 400
        const msg = err instanceof Error ? err.message : String(err)
        return { error: msg }
      }
    },
    {
      detail: {
        summary: "Confirm Completed S3 Upload",
        description:
          "Verifies physical S3 file existence and size, then transitions status from PENDING to ACTIVE.",
      },
      body: t.Object({
        fileId: t.String({
          description: "Storage file ID returned from presign",
        }),
        storageKey: t.Optional(t.String({ description: "Storage key" })),
        sizeBytes: t.Optional(
          t.Number({ description: "Actual uploaded size in bytes" })
        ),
        publicUrl: t.Optional(t.String({ description: "Optional public URL" })),
      }),
      response: {
        200: t.Object({
          id: t.String(),
          organizationId: t.String(),
          uploadedByUserId: t.Nullable(t.String()),
          purpose: t.String(),
          bucket: t.String(),
          storageKey: t.String(),
          originalFilename: t.String(),
          mimeType: t.String(),
          sizeBytes: t.Number(),
          status: t.String(),
          publicUrl: t.Nullable(t.String()),
          metadata: t.Nullable(t.Record(t.String(), t.Any())),
          expiresAt: t.Nullable(t.String()),
          confirmedAt: t.Nullable(t.String()),
          createdAt: t.String(),
          updatedAt: t.String(),
        }),
        400: t.Object({ error: t.String(), details: t.Optional(t.Any()) }),
        401: t.Object({ error: t.String() }),
      },
    }
  )
  /**
   * GET /api/storage/s3/view-url
   */
  .get(
    "/view-url",
    async ({ query, set, request }) => {
      const auth = await resolveAuthContext(request)
      const organizationId = auth?.organizationId ?? null

      if (!auth || !organizationId) {
        set.status = 401
        return { error: "Unauthorized: Missing active organization session" }
      }

      const fileId = query.fileId
      const storageKey = query.storageKey
      const shouldRedirect = query.redirect === "true" || query.redirect === "1"

      if (!fileId && !storageKey) {
        set.status = 400
        return { error: "Missing fileId or storageKey query parameter" }
      }

      try {
        const result = await StorageService.getTenantViewUrl({
          organizationId,
          fileId,
          storageKey,
        })

        // Standard cache-control header
        set.headers["Cache-Control"] =
          "private, max-age=600, stale-while-revalidate=60"

        if (shouldRedirect) {
          set.status = 307
          set.headers["Location"] = result.viewUrl
          return
        }

        return result
      } catch (err: unknown) {
        set.status = 403
        const msg = err instanceof Error ? err.message : String(err)
        return { error: msg }
      }
    },
    {
      detail: {
        summary: "Get Presigned View / Download URL",
        description:
          "Returns a fresh 15-minute presigned GET URL for secure in-browser viewing or streaming.",
      },
      query: t.Object({
        fileId: t.Optional(t.String({ description: "Target storage file ID" })),
        storageKey: t.Optional(t.String({ description: "Target storage key" })),
        redirect: t.Optional(
          t.String({
            description:
              "Pass 'true' to return an HTTP 307 redirect directly to S3",
          })
        ),
      }),
      response: {
        200: t.Object({
          viewUrl: t.String(),
          file: t.Object({
            id: t.String(),
            organizationId: t.String(),
            uploadedByUserId: t.Nullable(t.String()),
            purpose: t.String(),
            bucket: t.String(),
            storageKey: t.String(),
            originalFilename: t.String(),
            mimeType: t.String(),
            sizeBytes: t.Number(),
            status: t.String(),
            publicUrl: t.Nullable(t.String()),
            metadata: t.Nullable(t.Record(t.String(), t.Any())),
            expiresAt: t.Nullable(t.String()),
            confirmedAt: t.Nullable(t.String()),
            createdAt: t.String(),
            updatedAt: t.String(),
          }),
        }),
        400: t.Object({ error: t.String() }),
        401: t.Object({ error: t.String() }),
        403: t.Object({ error: t.String() }),
      },
    }
  )
