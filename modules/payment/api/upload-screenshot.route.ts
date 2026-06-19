import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { randomUUID } from "node:crypto"

export const createUploadScreenshotRoutes = () =>
  new Elysia({ prefix: "/upload-screenshot" }).post(
    "/",
    async ({ body, set }) => {
      const auth = await withAuth()
      if (!auth.organizationId) {
        set.status = 401
        return {
          ok: false,
          error: "UNAUTHORIZED",
          message: "Organization required",
        }
      }

      const file = body.file
      if (!file) {
        set.status = 400
        return { ok: false, error: "NO_FILE", message: "No file provided" }
      }

      // Validate file type — only PNG and JPG
      const allowedTypes = ["image/png", "image/jpeg"]
      if (!allowedTypes.includes(file.type)) {
        set.status = 400
        return {
          ok: false,
          error: "INVALID_TYPE",
          message: "Only PNG and JPG files are allowed",
        }
      }

      // Validate file size — 10MB max
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        set.status = 400
        return {
          ok: false,
          error: "FILE_TOO_LARGE",
          message: "File size must be under 10MB",
        }
      }

      const ext = file.type === "image/png" ? "png" : "jpg"
      const key = `payment-screenshots/${auth.organizationId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`

      const region = process.env.S3_REGION
      const bucket = process.env.S3_BUCKET
      const accessKeyId = process.env.S3_ACCESS_KEY_ID
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

      if (!region || !bucket || !accessKeyId || !secretAccessKey) {
        console.error(
          "[Upload Screenshot Error]: Missing S3 configuration — S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY must be set"
        )
        set.status = 503
        return {
          ok: false,
          error: "S3_CONFIG_ERROR",
          message:
            "Screenshot upload is temporarily unavailable due to missing storage configuration.",
        }
      }

      try {
        const s3 = new Bun.S3Client({
          region,
          bucket,
          endpoint: process.env.S3_ENDPOINT,
          accessKeyId,
          secretAccessKey,
          sessionToken: process.env.S3_SESSION_TOKEN,
        })

        const buffer = await file.arrayBuffer()
        const blob = new Blob([buffer], { type: file.type })
        await s3.write(key, blob)

        // Generate a presigned GET URL valid for 30 days so the admin panel can view it
        const url = s3.presign(key, {
          expiresIn: 30 * 24 * 60 * 60, // 30 days
        })

        return { ok: true, url, key }
      } catch (error) {
        console.error("[Upload Screenshot Error]:", error)
        set.status = 500
        return {
          ok: false,
          error: "UPLOAD_FAILED",
          message:
            "Failed to upload screenshot. Please try again or contact support.",
        }
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  )
