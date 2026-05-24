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

export const SUPPORT_TICKET_PRIORITIES = ["low", "medium", "high"] as const

export type SupportTicketPriority = (typeof SUPPORT_TICKET_PRIORITIES)[number]

export const SUPPORT_TICKET_SERVICES = [
  "auth",
  "billing",
  "deploy",
  "domains",
  "integrations",
  "data",
  "other",
] as const

export type SupportTicketService = (typeof SUPPORT_TICKET_SERVICES)[number]

export const SUPPORT_TICKET_ATTACHMENT_UPLOAD_TARGETS = [
  "create",
  "reply",
] as const

export type SupportTicketAttachmentUploadTarget =
  (typeof SUPPORT_TICKET_ATTACHMENT_UPLOAD_TARGETS)[number]

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

export const SUPPORT_TICKET_PRIORITY_LABELS: Record<
  SupportTicketPriority,
  string
> = {
  low: "Low",
  medium: "Medium",
  high: "High",
}

export const SUPPORT_TICKET_SERVICE_LABELS: Record<SupportTicketService, string> =
  {
    auth: "Auth",
    billing: "Billing",
    deploy: "Deploy",
    domains: "Domains",
    integrations: "Integrations",
    data: "Data",
    other: "Other",
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
  descriptionHtml?: string | null
  id: string
  priority: SupportTicketPriority
  resolvedAt: Date | null
  secureForm: string | null
  service: SupportTicketService | null
  status: SupportTicketStatus
  subject: string
  ticketNumber: string
  updatedAt: Date
  attachmentMetadata: SupportTicketAttachmentMetadata[]
  organizationName?: string | null
}

export type SupportTicketReply = {
  attachmentMetadata: SupportTicketAttachmentMetadata[]
  authorWorkosUserId: string
  body: string
  bodyHtml?: string | null
  createdAt: Date
  id: string
  isInternalNote: boolean
  secureForm: string | null
  ticketId: string
  updatedAt: Date
}

export type SupportTicketThread = {
  replies: SupportTicketReply[]
  ticket: SupportTicket
  users?: Record<
    string,
    {
      name: string
      avatarUrl: string | null
      isStaff: boolean
    }
  >
}

export type CreateSupportTicketInput = {
  attachmentMetadata?: SupportTicketAttachmentMetadata[]
  department: SupportTicketDepartment
  description?: string | null
  organizationId: string
  priority: SupportTicketPriority
  requesterWorkosUserId: string
  secureForm?: string | null
  service?: SupportTicketService | null
  subject: string
  uploadSessionIds?: string[]
}

export type CreateSupportTicketReplyInput = {
  attachmentMetadata?: SupportTicketAttachmentMetadata[]
  authorWorkosUserId: string
  body: string
  isInternalNote?: boolean
  secureForm?: string | null
  ticketId: string
  uploadSessionIds?: string[]
}

export type SupportTicketActorContext = {
  canManageTickets?: boolean
  isSuperAdmin?: boolean
  organizationId: string
  workosUserId: string
}

export type SupportTicketAttachmentUploadSession = {
  checksumSha256: string | null
  consumedAt: Date | null
  consumedReplyId: string | null
  consumedTicketId: string | null
  createdAt: Date
  expiresAt: Date
  fileName: string
  id: string
  mimeType: string
  organizationId: string
  registeredAt: Date | null
  sizeBytes: number
  storageBucket: string
  storageKey: string
  target: SupportTicketAttachmentUploadTarget
  ticketId: string | null
  updatedAt: Date
  uploaderWorkosUserId: string
}
