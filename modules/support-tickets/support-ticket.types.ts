export const SUPPORT_TICKET_DEPARTMENTS = [
  "billing",
  "technical",
  "account",
  "compliance",
] as const

export type SupportTicketDepartment =
  (typeof SUPPORT_TICKET_DEPARTMENTS)[number]

export const SUPPORT_TICKET_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number]

export const SUPPORT_TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> =
  {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  }

export const SUPPORT_TICKET_DEPARTMENT_LABELS: Record<
  SupportTicketDepartment,
  string
> = {
  billing: "Billing",
  technical: "Technical",
  account: "Account",
  compliance: "Compliance",
}

export type SupportTicketAttachmentMetadata = {
  checksumSha256?: string | null
  fileName: string
  id: string
  mimeType: string
  sizeBytes: number
  storageKey: string
  uploadedAt: string
}

export type SupportTicketOwnership = {
  assignedAgentWorkosUserId: string | null
  organizationId: string
  requesterWorkosUserId: string
}

export type SupportTicket = SupportTicketOwnership & {
  closedAt: Date | null
  createdAt: Date
  department: SupportTicketDepartment
  description: string | null
  id: string
  resolvedAt: Date | null
  status: SupportTicketStatus
  subject: string
  ticketNumber: string
  updatedAt: Date
  attachmentMetadata: SupportTicketAttachmentMetadata[]
}

export type SupportTicketReply = {
  attachmentMetadata: SupportTicketAttachmentMetadata[]
  authorWorkosUserId: string
  body: string
  createdAt: Date
  id: string
  isInternalNote: boolean
  ticketId: string
  updatedAt: Date
}

export type SupportTicketThread = {
  replies: SupportTicketReply[]
  ticket: SupportTicket
}

export type CreateSupportTicketInput = {
  attachmentMetadata?: SupportTicketAttachmentMetadata[]
  department: SupportTicketDepartment
  description?: string | null
  organizationId: string
  requesterWorkosUserId: string
  subject: string
}

export type CreateSupportTicketReplyInput = {
  attachmentMetadata?: SupportTicketAttachmentMetadata[]
  authorWorkosUserId: string
  body: string
  isInternalNote?: boolean
  ticketId: string
}

export type SupportTicketActorContext = {
  canManageTickets?: boolean
  isSuperAdmin?: boolean
  organizationId: string
  workosUserId: string
}
