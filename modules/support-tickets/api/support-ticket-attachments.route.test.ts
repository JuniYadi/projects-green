import { describe, expect, it } from "bun:test"
import { Elysia } from "elysia"

import { createSupportTicketAttachmentRoutes } from "@/modules/support-tickets/api/support-ticket-attachments.route"
import {
  SupportTicketAttachmentAccessDeniedError,
  SupportTicketAttachmentNotFoundError,
  SupportTicketAttachmentUploadExpiredError,
  SupportTicketAttachmentUploadMismatchError,
  type SupportTicketAttachmentService,
} from "@/modules/support-tickets/support-ticket-attachment.service"
import {
  SupportTicketAttachmentStorageConfigurationError,
  SupportTicketAttachmentUploadValidationError,
} from "@/modules/support-tickets/support-ticket-attachment.storage"
import { SupportTicketAttachmentValidationError } from "@/modules/support-tickets/support-ticket-attachment.validation"

const createApp = (service: Partial<SupportTicketAttachmentService>) => {
  const app = new Elysia().use(
    createSupportTicketAttachmentRoutes({
      authenticate: async () => ({
        organizationId: "org_1",
        role: "member",
        roles: ["member"],
        user: {
          id: "user_1",
          email: "user@example.com",
        },
      }),
      getPlatformRole: async () => "none",
      service: {
        async createPresignedAttachmentUpload() {
          return {
            attachmentId: "att_1",
            expiresAt: "2026-05-21T00:00:00.000Z",
            storageBucket: "support-ticket-bucket",
            storageKey:
              "support-ticket-attachments/org_1/create/pending/user_1/att_1.pdf",
            uploadUrl: "https://example.com/upload",
          }
        },
        async registerAttachment() {
          return {
            id: "att_1",
            fileName: "error.log.pdf",
            mimeType: "application/pdf",
            sizeBytes: 256,
            checksumSha256: null,
            storageKey:
              "support-ticket-attachments/org_1/create/pending/user_1/att_1.pdf",
            uploadedAt: "2026-05-21T00:00:00.000Z",
          }
        },
        ...service,
      },
    })
  )

  return app
}

describe("support ticket attachment routes", () => {
  it("creates presigned upload session", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/presign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          fileName: "error.log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 256,
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      attachment: {
        attachmentId: "att_1",
      },
    })
  })

  it("returns forbidden when service denies presign", async () => {
    const app = createApp({
      async createPresignedAttachmentUpload() {
        throw new SupportTicketAttachmentAccessDeniedError(
          "upload attachments to"
        )
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/presign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "reply",
          ticketId: "ticket_1",
          fileName: "error.log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 256,
        }),
      })
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "FORBIDDEN",
    })
  })

  it("registers uploaded attachment", async () => {
    const app = createApp({})

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          id: "att_1",
          fileName: "error.log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 256,
          storageBucket: "support-ticket-bucket",
          storageKey:
            "support-ticket-attachments/org_1/create/pending/user_1/att_1.pdf",
        }),
      })
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      ok: true,
      attachment: {
        id: "att_1",
      },
    })
  })

  it("maps upload expired error", async () => {
    const app = createApp({
      async registerAttachment() {
        throw new SupportTicketAttachmentUploadExpiredError()
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          id: "att_1",
          fileName: "error.log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 256,
          storageBucket: "support-ticket-bucket",
          storageKey:
            "support-ticket-attachments/org_1/create/pending/user_1/att_1.pdf",
        }),
      })
    )

    expect(response.status).toBe(410)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "UPLOAD_NOT_FOUND_OR_EXPIRED",
    })
  })

  it("maps registration mismatch error", async () => {
    const app = createApp({
      async registerAttachment() {
        throw new SupportTicketAttachmentUploadMismatchError("mismatch")
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          id: "att_1",
          fileName: "error.log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 256,
          storageBucket: "support-ticket-bucket",
          storageKey:
            "support-ticket-attachments/org_1/create/pending/user_1/att_1.pdf",
        }),
      })
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "UPLOAD_VALIDATION_FAILED",
    })
  })

  it("maps not found error on presign", async () => {
    const app = createApp({
      async createPresignedAttachmentUpload() {
        throw new SupportTicketAttachmentNotFoundError("presign")
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/presign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          fileName: "error.log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 256,
        }),
      })
    )

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "TICKET_NOT_FOUND",
    })
  })

  it("maps validation error with file too large", async () => {
    const app = createApp({
      async createPresignedAttachmentUpload() {
        throw new SupportTicketAttachmentValidationError(
          "FILE_TOO_LARGE",
          "File exceeds maximum size of 10MB"
        )
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/presign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          fileName: "huge.pdf",
          mimeType: "application/pdf",
          sizeBytes: 999999999,
        }),
      })
    )

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "FILE_TOO_LARGE",
    })
  })

  it("maps validation error with invalid mime type", async () => {
    const app = createApp({
      async createPresignedAttachmentUpload() {
        throw new SupportTicketAttachmentValidationError(
          "INVALID_MIME_TYPE",
          "File type not allowed"
        )
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/presign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          fileName: "virus.exe",
          mimeType: "application/x-executable",
          sizeBytes: 256,
        }),
      })
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "INVALID_MIME_TYPE",
    })
  })

  it("maps storage configuration error", async () => {
    const app = createApp({
      async createPresignedAttachmentUpload() {
        throw new SupportTicketAttachmentStorageConfigurationError()
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/presign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          fileName: "error.log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 256,
        }),
      })
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "STORAGE_MISCONFIGURED",
    })
  })

  it("maps upload validation error", async () => {
    const app = createApp({
      async registerAttachment() {
        throw new SupportTicketAttachmentUploadValidationError("checksum mismatch")
      },
    })

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          id: "att_1",
          fileName: "error.log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 256,
          storageBucket: "support-ticket-bucket",
          storageKey:
            "support-ticket-attachments/org_1/create/pending/user_1/att_1.pdf",
        }),
      })
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "UPLOAD_VALIDATION_FAILED",
    })
  })

  it("returns 401 when user is not authenticated", async () => {
    const app = new Elysia().use(
      createSupportTicketAttachmentRoutes({
        authenticate: async () => ({
          organizationId: "org_1",
          role: "member",
          roles: ["member"],
          user: null,
        }),
        getPlatformRole: async () => "none",
        service: {
          async createPresignedAttachmentUpload() {
            return {
              attachmentId: "att_1",
              expiresAt: "2026-05-21T00:00:00.000Z",
              storageBucket: "support-ticket-bucket",
              storageKey:
                "support-ticket-attachments/org_1/create/pending/user_1/att_1.pdf",
              uploadUrl: "https://example.com/upload",
            }
          },
          async registerAttachment() {
            return {
              id: "att_1",
              fileName: "error.log.pdf",
              mimeType: "application/pdf",
              sizeBytes: 256,
              checksumSha256: null,
              storageKey:
                "support-ticket-attachments/org_1/create/pending/user_1/att_1.pdf",
              uploadedAt: "2026-05-21T00:00:00.000Z",
            }
          },
        },
      })
    )

    const response = await app.handle(
      new Request("http://localhost/support-tickets/attachments/presign", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          target: "create",
          fileName: "error.log.pdf",
          mimeType: "application/pdf",
          sizeBytes: 256,
        }),
      })
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: "UNAUTHORIZED",
    })
  })
})
