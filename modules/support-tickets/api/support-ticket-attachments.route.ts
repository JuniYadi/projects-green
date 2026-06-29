import { Elysia, t } from "elysia"
import { withAuth } from "@workos-inc/authkit-nextjs"
import { z } from "zod"

import {
  createSupportTicketAttachmentService,
  SupportTicketAttachmentAccessDeniedError,
  SupportTicketAttachmentNotFoundError,
  SupportTicketAttachmentUploadExpiredError,
  SupportTicketAttachmentUploadMismatchError,
  type SupportTicketAttachmentActorContext,
  type SupportTicketAttachmentService,
} from "@/modules/support-tickets/support-ticket-attachment.service"
import {
  SupportTicketAttachmentStorageConfigurationError,
  SupportTicketAttachmentUploadValidationError,
} from "@/modules/support-tickets/support-ticket-attachment.storage"
import {
  SupportTicketAttachmentValidationError,
  supportTicketAttachmentUploadInputSchema,
} from "@/modules/support-tickets/support-ticket-attachment.validation"
import { supportTicketAttachmentUploadTargetSchema } from "@/modules/support-tickets/support-ticket.schema"
import {
  resolveTenantRoleFromClaims,
  hasScopedSuperAdminClaim,
} from "@/modules/tenants/tenant-policy"

type SupportTicketAuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: {
    email?: string | null
    id: string
  } | null
}

type RouteSet = {
  status?: number | string
}

type SupportTicketAttachmentRouteDependencies = {
  authenticate: () => Promise<SupportTicketAuthContext>
  getPlatformRole: (input: {
    email?: string | null
    id?: string | null
  }) => Promise<"none" | "super_admin">
  service: SupportTicketAttachmentService
}

const createDefaultDependencies =
  (): SupportTicketAttachmentRouteDependencies => ({
    authenticate: () => withAuth(),
    getPlatformRole: async (input) => {
      const platformRoleModule = await import("@/lib/platform-role")
      return platformRoleModule.getPlatformRoleForUser(input)
    },
    service: createSupportTicketAttachmentService(),
  })

const toUnauthorized = (set: RouteSet) => {
  set.status = 401

  return {
    ok: false as const,
    error: "UNAUTHORIZED" as const,
    message: "You must be signed in to upload support ticket attachments.",
  }
}

const toErrorResponse = (set: RouteSet, error: unknown) => {
  console.error("[Attachment API Error]:", error)
  if (error instanceof SupportTicketAttachmentNotFoundError) {
    set.status = 404
    return {
      ok: false as const,
      error: "TICKET_NOT_FOUND" as const,
      message: error.message,
    }
  }

  if (error instanceof SupportTicketAttachmentAccessDeniedError) {
    set.status = 403
    return {
      ok: false as const,
      error: "FORBIDDEN" as const,
      message: error.message,
    }
  }

  if (error instanceof SupportTicketAttachmentValidationError) {
    if (error.code === "FILE_TOO_LARGE") {
      set.status = 413
      return {
        ok: false as const,
        error: error.code,
        message: error.message,
      }
    }

    set.status = 422
    return {
      ok: false as const,
      error: error.code,
      message: error.message,
    }
  }

  if (error instanceof SupportTicketAttachmentUploadExpiredError) {
    set.status = 410
    return {
      ok: false as const,
      error: "UPLOAD_NOT_FOUND_OR_EXPIRED" as const,
      message: error.message,
    }
  }

  if (error instanceof SupportTicketAttachmentUploadMismatchError) {
    set.status = 422
    return {
      ok: false as const,
      error: "UPLOAD_VALIDATION_FAILED" as const,
      message: error.message,
    }
  }

  if (error instanceof SupportTicketAttachmentUploadValidationError) {
    set.status = 422
    return {
      ok: false as const,
      error: "UPLOAD_VALIDATION_FAILED" as const,
      message: error.message,
    }
  }

  if (error instanceof SupportTicketAttachmentStorageConfigurationError) {
    set.status = 500
    return {
      ok: false as const,
      error: "STORAGE_MISCONFIGURED" as const,
      message: "Support ticket attachment storage is not configured.",
    }
  }

  throw error
}

const toAttachmentActorContext = async (
  auth: SupportTicketAuthContext,
  getPlatformRole: SupportTicketAttachmentRouteDependencies["getPlatformRole"]
): Promise<SupportTicketAttachmentActorContext> => {
  const user = auth.user

  if (!user) {
    throw new Error("UNAUTHORIZED")
  }

  const platformRole = await getPlatformRole({
    id: user.id,
    email: user.email,
  })
  const tenantRole = resolveTenantRoleFromClaims(auth.role, auth.roles ?? null)
  const hasClaimedSuperAdmin = hasScopedSuperAdminClaim(
    auth.role,
    auth.roles ?? null
  )

  return {
    workosUserId: user.id,
    organizationId: auth.organizationId ?? null,
    isSuperAdmin: platformRole === "super_admin" || hasClaimedSuperAdmin,
    canManageTickets: tenantRole === "owner" || tenantRole === "admin",
  }
}

const createRouteHandler = (
  dependencies: SupportTicketAttachmentRouteDependencies,
  handler: (input: {
    actor: SupportTicketAttachmentActorContext
    body: Record<string, unknown>
    set: RouteSet
  }) => Promise<unknown>
) => {
  return async ({
    body,
    set,
  }: {
    body: Record<string, unknown>
    set: RouteSet
  }) => {
    const auth = await dependencies.authenticate()

    if (!auth.user) {
      return toUnauthorized(set)
    }

    try {
      const actor = await toAttachmentActorContext(
        auth,
        dependencies.getPlatformRole
      )
      return await handler({
        actor,
        body,
        set,
      })
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return toUnauthorized(set)
      }

      return toErrorResponse(set, error)
    }
  }
}

const supportTicketAttachmentPresignInputSchema =
  supportTicketAttachmentUploadInputSchema.extend({
    target: supportTicketAttachmentUploadTargetSchema,
    ticketId: z.string().trim().min(1).optional(),
  })

const supportTicketAttachmentRegisterInputSchema =
  supportTicketAttachmentUploadInputSchema.extend({
    id: z.string().trim().min(1, "id is required."),
    storageBucket: z.string().trim().min(1, "storageBucket is required."),
    storageKey: z.string().trim().min(1, "storageKey is required."),
    target: supportTicketAttachmentUploadTargetSchema,
    ticketId: z.string().trim().min(1).optional(),
  })

export const createSupportTicketAttachmentRoutes = (
  dependencies: SupportTicketAttachmentRouteDependencies = createDefaultDependencies()
) => {
  return new Elysia({ prefix: "/support-tickets" })
    .post(
      "/attachments/upload",
      async ({ body, set }) => {
        const auth = await dependencies.authenticate()
        if (!auth.user) {
          return toUnauthorized(set)
        }

        const uploadUrl = String(body.uploadUrl)
        const mimeType = String(body.mimeType || "application/octet-stream")

        // Validate the uploadUrl references the configured S3 endpoint and bucket
        const s3Endpoint = (process.env.S3_ENDPOINT || "").trim()
        const s3Bucket = (process.env.S3_BUCKET || "").trim()

        if (s3Endpoint && s3Bucket) {
          try {
            const url = new URL(uploadUrl)
            const endpointUrl = new URL(s3Endpoint)
            const endpointHost = endpointUrl.hostname

            // Path-style: https://s3.region.amazonaws.com/bucket/key
            const isPathStyle =
              url.hostname === endpointHost &&
              url.pathname.startsWith(`/${s3Bucket}/`)

            // Virtual-hosted: https://bucket.s3.region.amazonaws.com/key
            const isVirtualHosted = url.hostname === `${s3Bucket}.${endpointHost}`

            if (!isPathStyle && !isVirtualHosted) {
              console.error(
                "[Attachment Upload Proxy] S3 URL validation failed:",
                { uploadUrl, s3Endpoint, s3Bucket, urlHostname: url.hostname }
              )
              set.status = 403
              return {
                ok: false as const,
                error: "FORBIDDEN" as const,
                message: "Upload URL does not match configured storage endpoint.",
              }
            }
          } catch {
            // Invalid URL format — let it fail naturally at the fetch step
          }
        }

        try {
          const fileBuffer = await body.file.arrayBuffer()
          const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "content-type": mimeType },
            body: fileBuffer,
          })

          if (!response.ok) {
            set.status = 502
            return {
              ok: false as const,
              error: "UPLOAD_FAILED" as const,
              message: `S3 upload failed with status ${response.status}`,
            }
          }

          return {
            ok: true as const,
          }
        } catch (error) {
          console.error("[Attachment Upload Proxy Error]:", error)
          set.status = 502
          return {
            ok: false as const,
            error: "UPLOAD_FAILED" as const,
            message:
              error instanceof Error ? error.message : "Failed to upload to S3",
          }
        }
      },
      {
        body: t.Object({
          uploadUrl: t.String(),
          mimeType: t.String(),
          file: t.File(),
        }),
      }
    )
    .post(
      "/attachments/presign",
      createRouteHandler(dependencies, async ({ actor, body }) => {
        const upload =
          await dependencies.service.createPresignedAttachmentUpload({
            actor,
            target: body.target as "create" | "reply",
            ticketId:
              typeof body.ticketId === "string"
                ? String(body.ticketId)
                : undefined,
            fileName: String(body.fileName),
            mimeType: String(body.mimeType),
            sizeBytes: Number(body.sizeBytes),
            checksumSha256:
              body.checksumSha256 === null || body.checksumSha256 === undefined
                ? undefined
                : String(body.checksumSha256),
          })

        return {
          ok: true as const,
          attachment: upload,
        }
      }),
      {
        body: supportTicketAttachmentPresignInputSchema,
      }
    )
    .post(
      "/attachments/register",
      createRouteHandler(dependencies, async ({ actor, body }) => {
        const attachment = await dependencies.service.registerAttachment({
          actor,
          target: body.target as "create" | "reply",
          ticketId:
            typeof body.ticketId === "string"
              ? String(body.ticketId)
              : undefined,
          id: String(body.id),
          fileName: String(body.fileName),
          mimeType: String(body.mimeType),
          sizeBytes: Number(body.sizeBytes),
          storageBucket: String(body.storageBucket),
          storageKey: String(body.storageKey),
          checksumSha256:
            body.checksumSha256 === null || body.checksumSha256 === undefined
              ? undefined
              : String(body.checksumSha256),
        })

        return {
          ok: true as const,
          attachment,
        }
      }),
      {
        body: supportTicketAttachmentRegisterInputSchema,
      }
    )
}

export const supportTicketAttachmentRoutes =
  createSupportTicketAttachmentRoutes()
