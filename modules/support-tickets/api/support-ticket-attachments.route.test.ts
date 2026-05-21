import { describe, expect, it } from "bun:test"
import { Elysia } from "elysia"

import { createSupportTicketAttachmentRoutes } from "@/modules/support-tickets/api/support-ticket-attachments.route"
import {
  SupportTicketAttachmentAccessDeniedError,
  type SupportTicketAttachmentService,
  SupportTicketAttachmentUploadExpiredError,
  SupportTicketAttachmentUploadMismatchError,
} from "@/modules/support-tickets/support-ticket-attachment.service"

type AuthContext = {
  organizationId?: string | null
  role?: string | null
  roles?: string[] | null
  user: {
    email?: string | null
    id: string
  } | null
}

const createApp = (input: {
  auth: AuthContext
  service?: Partial<SupportTicketAttachmentService>
}) => {
  const defaultService: SupportTicketAttachmentService = {
    async createPresignedAttachmentUpload() {
      return {
        attachmentId: "att_1",
        expiresAt: "2026-05-21T01:00:00.000Z",
        storageBucket: "support-ticket-bucket",
        storageKey:
          "support-ticket-attachments/org_1/ticket_1/user_1/att_1.pdf",
        uploadUrl: "https://example.com/upload",
      }
    },
    async registerAttachment() {
      return {
        id: "att_1",
        fileName: "incident.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        storageKey:
          "support-ticket-attachments/org_1/ticket_1/user_1/att_1.pdf",
        uploadedAt: "2026-05-21T00:00:00.000Z",
      }
    },
  }
  const service: SupportTicketAttachmentService = {
    ...defaultService,
    ...input.service,
  }

  return new Elysia().use(
    createSupportTicketAttachmentRoutes({
      authenticate: async () => input.auth,
      getPlatformRole: async () => "none",
      service,
    })
  )
}

describe("support ticket attachment routes", () => {
  it("returns unauthorized when no user is present", async () => {
    const app = createApp({
      auth: {
        user: null,
        organizationId: null,
      },
    })

    const response = await app.handle(
      new Request(
        "http://localhost/support-tickets/ticket_1/attachments/presign",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            fileName: "incident.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024,
          }),
        }
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(401)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("returns forbidden when service denies presign", async () => {
    const app = createApp({
      auth: {
        user: {
          id: "user_1",
        },
        organizationId: "org_1",
        role: "user/member",
        roles: ["user/member"],
      },
      service: {
        async createPresignedAttachmentUpload() {
          throw new SupportTicketAttachmentAccessDeniedError(
            "upload attachments to"
          )
        },
      },
    })

    const response = await app.handle(
      new Request(
        "http://localhost/support-tickets/ticket_1/attachments/presign",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            fileName: "incident.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024,
          }),
        }
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(403)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("FORBIDDEN")
  })

  it("returns upload expired error when registration upload object is missing", async () => {
    const app = createApp({
      auth: {
        user: {
          id: "user_1",
        },
        organizationId: "org_1",
        role: "user/member",
        roles: ["user/member"],
      },
      service: {
        async registerAttachment() {
          throw new SupportTicketAttachmentUploadExpiredError()
        },
      },
    })

    const response = await app.handle(
      new Request(
        "http://localhost/support-tickets/ticket_1/attachments/register",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            id: "att_1",
            fileName: "incident.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024,
            storageKey:
              "support-ticket-attachments/org_1/ticket_1/user_1/att_1.pdf",
          }),
        }
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(410)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UPLOAD_NOT_FOUND_OR_EXPIRED")
  })

  it("maps upload validation mismatch during registration", async () => {
    const app = createApp({
      auth: {
        user: {
          id: "user_1",
        },
        organizationId: "org_1",
        role: "user/member",
        roles: ["user/member"],
      },
      service: {
        async registerAttachment() {
          throw new SupportTicketAttachmentUploadMismatchError(
            "Attachment storage key does not match ticket ownership scope."
          )
        },
      },
    })

    const response = await app.handle(
      new Request(
        "http://localhost/support-tickets/ticket_1/attachments/register",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            id: "att_1",
            fileName: "incident.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024,
            storageKey:
              "support-ticket-attachments/org_1/ticket_1/user_1/att_1.pdf",
          }),
        }
      )
    )
    const body = (await response.json()) as {
      ok: boolean
      error: string
    }

    expect(response.status).toBe(422)
    expect(body.ok).toBe(false)
    expect(body.error).toBe("UPLOAD_VALIDATION_FAILED")
  })
})
