import type {
  SupportTicket,
  SupportTicketReply,
  SupportTicketThread,
  SupportTicketListResult,
  SupportTicketDepartment,
  SupportTicketPriority,
  SupportTicketService,
  SupportTicketStatus,
  SupportTicketAttachmentMetadata,
} from "./support-ticket.types"

export type SupportTicketDTO = {
  id: string
  ticketNumber: string
  organizationId: string
  organizationName?: string | null
  organizationMetadata?: Record<string, string> | null
  requesterWorkosUserId: string
  requesterName?: string | null
  assignedAgentWorkosUserId: string | null
  department: SupportTicketDepartment
  service: SupportTicketService | null
  priority: SupportTicketPriority
  status: SupportTicketStatus
  subject: string
  description: string | null
  descriptionHtml?: string | null
  secureForm: string | null
  attachmentMetadata: SupportTicketAttachmentMetadata[]
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
}

export type SupportTicketReplyDTO = {
  id: string
  ticketId: string
  authorWorkosUserId: string
  body: string
  bodyHtml?: string | null
  secureForm: string | null
  isInternalNote: boolean
  attachmentMetadata: SupportTicketAttachmentMetadata[]
  createdAt: string
  updatedAt: string
}

export type SupportTicketThreadDTO = {
  ticket: SupportTicketDTO
  replies: SupportTicketReplyDTO[]
  users?: Record<
    string,
    {
      name: string
      avatarUrl: string | null
      isStaff: boolean
    }
  >
}

export type SupportTicketListDTO = {
  tickets: SupportTicketDTO[]
  total: number
  page: number
  pageSize: number
}

export function toSupportTicketDTO(ticket: SupportTicket): SupportTicketDTO {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    organizationId: ticket.organizationId,
    organizationName: ticket.organizationName ?? null,
    organizationMetadata: ticket.organizationMetadata ?? null,
    requesterWorkosUserId: ticket.requesterWorkosUserId,
    requesterName: ticket.requesterName ?? null,
    assignedAgentWorkosUserId: ticket.assignedAgentWorkosUserId,
    department: ticket.department,
    service: ticket.service,
    priority: ticket.priority,
    status: ticket.status,
    subject: ticket.subject,
    description: ticket.description,
    descriptionHtml: ticket.descriptionHtml ?? null,
    secureForm: ticket.secureForm,
    attachmentMetadata: ticket.attachmentMetadata ?? [],
    createdAt:
      ticket.createdAt instanceof Date
        ? ticket.createdAt.toISOString()
        : String(ticket.createdAt),
    updatedAt:
      ticket.updatedAt instanceof Date
        ? ticket.updatedAt.toISOString()
        : String(ticket.updatedAt),
    resolvedAt:
      ticket.resolvedAt instanceof Date
        ? ticket.resolvedAt.toISOString()
        : ticket.resolvedAt
          ? String(ticket.resolvedAt)
          : null,
    closedAt:
      ticket.closedAt instanceof Date
        ? ticket.closedAt.toISOString()
        : ticket.closedAt
          ? String(ticket.closedAt)
          : null,
  }
}

export function toSupportTicketReplyDTO(
  reply: SupportTicketReply
): SupportTicketReplyDTO {
  return {
    id: reply.id,
    ticketId: reply.ticketId,
    authorWorkosUserId: reply.authorWorkosUserId,
    body: reply.body,
    bodyHtml: reply.bodyHtml ?? null,
    secureForm: reply.secureForm,
    isInternalNote: reply.isInternalNote,
    attachmentMetadata: reply.attachmentMetadata ?? [],
    createdAt:
      reply.createdAt instanceof Date
        ? reply.createdAt.toISOString()
        : String(reply.createdAt),
    updatedAt:
      reply.updatedAt instanceof Date
        ? reply.updatedAt.toISOString()
        : String(reply.updatedAt),
  }
}

export function toSupportTicketThreadDTO(
  thread: SupportTicketThread
): SupportTicketThreadDTO {
  return {
    ticket: toSupportTicketDTO(thread.ticket),
    replies: (thread.replies ?? []).map(toSupportTicketReplyDTO),
    users: thread.users,
  }
}

export function toSupportTicketListDTO(
  result: SupportTicketListResult
): SupportTicketListDTO {
  return {
    tickets: result.tickets.map(toSupportTicketDTO),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  }
}
