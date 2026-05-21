import { describe, expect, it } from "bun:test"

import {
  createSupportTicketAttachmentService,
  SupportTicketAttachmentAccessDeniedError,
  SupportTicketAttachmentUploadExpiredError,
} from "@/modules/support-tickets/support-ticket-attachment.service"
import { SupportTicketAttachmentUploadNotFoundError } from "@/modules/support-tickets/support-ticket-attachment.storage"
import { SupportTicketAttachmentValidationError } from "@/modules/support-tickets/support-ticket-attachment.validation"
import type { SupportTicket } from "@/modules/support-tickets/support-ticket.types"

const baseTicket: SupportTicket = {
  id: "ticket_1",
  ticketNumber: "TCK-9001",
  organizationId: "org_1",
  requesterWorkosUserId: "user_requester",
  assignedAgentWorkosUserId: "user_agent",
  department: "technical",
  status: "open",
  subject: "subject",
  description: "description",
  attachmentMetadata: [],
  createdAt: new Date("2026-05-21T00:00:00.000Z"),
  updatedAt: new Date("2026-05-21T00:00:00.000Z"),
  resolvedAt: null,
  closedAt: null,
}

const actor = {
  workosUserId: "user_requester",
  organizationId: "org_1",
}

const createDeps = () => {
  const attachments: Array<{ id: string; storageKey: string }> = []

  return {
    attachments,
    repository: {
      async getTicketById(ticketId: string) {
        if (ticketId !== baseTicket.id) {
          return null
        }

        return baseTicket
      },
      async appendTicketAttachment(input: {
        attachment: {
          id: string
          storageKey: string
        }
      }) {
        attachments.push(input.attachment)
        return []
      },
    },
    storage: {
      async createPresignedUpload(input: { extension: string }) {
        return {
          bucket: "support-ticket-bucket",
          key: `support-ticket-attachments/org_1/ticket_1/user_requester/1.${input.extension}`,
          uploadUrl: "https://example.com/upload",
          expiresAt: "2026-05-21T01:00:00.000Z",
        }
      },
      getExpectedStorageKeyPrefix() {
        return "support-ticket-attachments/org_1/ticket_1/user_requester"
      },
      async verifyUploadedObject() {
        return
      },
    },
  }
}

describe("support ticket attachment service", () => {
  it("rejects presign for unauthorized actor", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    await expect(
      service.createPresignedAttachmentUpload({
        actor: {
          workosUserId: "user_other",
          organizationId: "org_1",
        },
        ticketId: "ticket_1",
        fileName: "incident.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentAccessDeniedError)
  })

  it("rejects unsupported extension on presign", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    await expect(
      service.createPresignedAttachmentUpload({
        actor,
        ticketId: "ticket_1",
        fileName: "malware.exe",
        mimeType: "application/octet-stream",
        sizeBytes: 2048,
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentValidationError)
  })

  it("registers validated attachment metadata", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService(deps)

    const attachment = await service.registerAttachment({
      actor,
      ticketId: "ticket_1",
      id: "att_1",
      fileName: "incident.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      storageKey:
        "support-ticket-attachments/org_1/ticket_1/user_requester/123-att.pdf",
    })

    expect(attachment.id).toBe("att_1")
    expect(attachment.storageKey).toContain("support-ticket-attachments")
    expect(deps.attachments).toHaveLength(1)
    expect(deps.attachments[0]?.id).toBe("att_1")
  })

  it("rejects registration when uploaded object is missing or expired", async () => {
    const deps = createDeps()
    const service = createSupportTicketAttachmentService({
      repository: deps.repository,
      storage: {
        ...deps.storage,
        async verifyUploadedObject() {
          throw new SupportTicketAttachmentUploadNotFoundError()
        },
      },
    })

    await expect(
      service.registerAttachment({
        actor,
        ticketId: "ticket_1",
        id: "att_1",
        fileName: "incident.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        storageKey:
          "support-ticket-attachments/org_1/ticket_1/user_requester/123-att.pdf",
      })
    ).rejects.toBeInstanceOf(SupportTicketAttachmentUploadExpiredError)
  })
})
