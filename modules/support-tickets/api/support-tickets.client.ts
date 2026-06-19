import type {
  SupportTicket,
  SupportTicketAttachmentMetadata,
  SupportTicketAttachmentUploadTarget,
  SupportTicketDepartment,
  SupportTicketPriority,
  SupportTicketReply,
  SupportTicketService,
  SupportTicketStatus,
} from "@/modules/support-tickets/support-ticket.types"

type TicketThreadResponse = {
  ticket: SupportTicket
  replies: SupportTicketReply[]
  users?: Record<
    string,
    {
      name: string
      avatarUrl: string | null
      isStaff: boolean
    }
  >
}

const parseJsonSafely = async (response: Response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const toErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") {
    return fallback
  }

  if ("message" in payload && typeof payload.message === "string") {
    return payload.message
  }

  return fallback
}

const requestJson = async <T>(
  path: string,
  init?: RequestInit,
  fallbackErrorMessage = "Request failed"
): Promise<T> => {
  const response = await fetch(path, init)
  const payload = await parseJsonSafely(response)

  if (!response.ok) {
    throw new Error(toErrorMessage(payload, fallbackErrorMessage))
  }

  return payload as T
}

export const createSupportTicketsClient = () => {
  return {
    async listTickets() {
      const payload = await requestJson<{
        ok: true
        tickets: SupportTicket[]
      }>("/api/support-tickets", undefined, "Unable to load support tickets.")

      return payload.tickets
    },
    async createTicket(input: {
      department: SupportTicketDepartment
      description?: string | null
      priority: SupportTicketPriority
      secureForm?: string | null
      service?: SupportTicketService | null
      subject: string
      uploadSessionIds?: string[]
    }) {
      const payload = await requestJson<{
        ok: true
        ticket: SupportTicket
      }>(
        "/api/support-tickets",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(input),
        },
        "Unable to create support ticket."
      )

      return payload.ticket
    },
    async getTicketThread(ticketId: string) {
      const payload = await requestJson<{
        ok: true
        thread: TicketThreadResponse
      }>(
        `/api/support-tickets/${ticketId}`,
        undefined,
        "Unable to load support ticket thread."
      )

      return payload.thread
    },
    async addReply(input: {
      body: string
      isInternalNote?: boolean
      secureForm?: string | null
      ticketId: string
      uploadSessionIds?: string[]
    }) {
      const payload = await requestJson<{
        ok: true
        reply: SupportTicketReply
      }>(
        `/api/support-tickets/${input.ticketId}/replies`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            body: input.body,
            isInternalNote: input.isInternalNote,
            secureForm: input.secureForm,
            uploadSessionIds: input.uploadSessionIds ?? [],
          }),
        },
        "Unable to add support ticket reply."
      )

      return payload.reply
    },
    async closeTicket(ticketId: string) {
      const payload = await requestJson<{
        ok: true
        ticket: SupportTicket
      }>(
        `/api/support-tickets/${ticketId}/close`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: "{}",
        },
        "Unable to close support ticket."
      )

      return payload.ticket
    },
    async presignAttachment(input: {
      checksumSha256?: string | null
      fileName: string
      mimeType: string
      sizeBytes: number
      target: SupportTicketAttachmentUploadTarget
      ticketId?: string
    }) {
      const payload = await requestJson<{
        ok: true
        attachment: {
          attachmentId: string
          expiresAt: string
          storageBucket: string
          storageKey: string
          uploadUrl: string
        }
      }>(
        "/api/support-tickets/attachments/presign",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(input),
        },
        "Unable to prepare attachment upload."
      )

      return payload.attachment
    },
    async uploadAttachmentObject(input: { file: File; uploadUrl: string }) {
      const formData = new FormData()
      formData.append("file", input.file)
      formData.append("uploadUrl", input.uploadUrl)
      formData.append("mimeType", input.file.type || "application/octet-stream")

      const response = await fetch("/api/support-tickets/attachments/upload", {
        method: "POST",
        body: formData,
      })

      const payload = await parseJsonSafely(response)

      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("ok" in payload) ||
        !payload.ok
      ) {
        throw new Error("Attachment upload failed.")
      }
    },
    async registerAttachment(input: {
      checksumSha256?: string | null
      fileName: string
      id: string
      mimeType: string
      sizeBytes: number
      storageBucket: string
      storageKey: string
      target: SupportTicketAttachmentUploadTarget
      ticketId?: string
    }) {
      const payload = await requestJson<{
        ok: true
        attachment: SupportTicketAttachmentMetadata
      }>(
        "/api/support-tickets/attachments/register",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(input),
        },
        "Unable to finalize attachment upload."
      )

      return payload.attachment
    },
    async listAdminTickets() {
      const payload = await requestJson<{
        ok: true
        tickets: SupportTicket[]
      }>(
        "/api/support-tickets/admin",
        undefined,
        "Unable to load support tickets."
      )

      return payload.tickets
    },
    async createAdminTicket(input: {
      organizationId: string
      department: SupportTicketDepartment
      description?: string | null
      priority: SupportTicketPriority
      secureForm?: string | null
      service?: SupportTicketService | null
      subject: string
      uploadSessionIds?: string[]
    }) {
      const payload = await requestJson<{
        ok: true
        ticket: SupportTicket
      }>(
        "/api/support-tickets/admin",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(input),
        },
        "Unable to create support ticket."
      )

      return payload.ticket
    },
    async updateAdminTicket(
      ticketId: string,
      data: {
        department?: SupportTicketDepartment
        priority?: SupportTicketPriority
        service?: SupportTicketService | null
        subject?: string
        description?: string | null
        status?: SupportTicketStatus
        assignedAgentWorkosUserId?: string | null
      }
    ) {
      const payload = await requestJson<{
        ok: true
        ticket: SupportTicket
      }>(
        `/api/support-tickets/admin/${ticketId}`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(data),
        },
        "Unable to update support ticket."
      )

      return payload.ticket
    },
    async deleteAdminTicket(ticketId: string) {
      const payload = await requestJson<{
        ok: true
      }>(
        `/api/support-tickets/admin/${ticketId}`,
        {
          method: "DELETE",
        },
        "Unable to delete support ticket."
      )

      return payload.ok
    },
    async listAdminOrganizations() {
      const payload = await requestJson<{
        ok: true
        organizations: Array<{ id: string; name: string }>
      }>(
        "/api/support-tickets/admin/organizations",
        undefined,
        "Unable to load organizations."
      )

      return payload.organizations
    },
  }
}
