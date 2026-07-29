import type { EmailLogType } from "@prisma/client"

export type EmailLogListItemDTO = {
  id: string
  recipientEmail: string
  type: string
  subject: string
  status: string
  organizationId: string | null
  relatedEntityType: string | null
  relatedEntityId: string | null
  ticketId: string | null
  ticketNumber: string | null
  providerMessageId: string | null
  errorMessage: string | null
  attempts: number
  sentAt: string | null
  createdAt: string
  updatedAt: string
  hasPreview: boolean
}

export type EmailLogDetailDTO = EmailLogListItemDTO & {
  previewUrl: string | null
}

export function toEmailLogListItemDTO(log: {
  id: string
  recipientEmail: string
  type: EmailLogType
  subject: string
  status: string
  organizationId: string | null
  relatedEntityType: string | null
  relatedEntityId: string | null
  ticketId: string | null
  ticketNumber: string | null
  providerMessageId: string | null
  errorMessage: string | null
  attempts: number
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
  bodyHtml: string | null
}): EmailLogListItemDTO {
  return {
    id: log.id,
    recipientEmail: log.recipientEmail,
    type: log.type,
    subject: log.subject,
    status: log.status,
    organizationId: log.organizationId,
    relatedEntityType: log.relatedEntityType,
    relatedEntityId: log.relatedEntityId,
    ticketId: log.ticketId,
    ticketNumber: log.ticketNumber,
    providerMessageId: log.providerMessageId,
    errorMessage: log.errorMessage,
    attempts: log.attempts,
    sentAt: log.sentAt?.toISOString() ?? null,
    createdAt: log.createdAt.toISOString(),
    updatedAt: log.updatedAt.toISOString(),
    hasPreview: Boolean(log.bodyHtml),
  }
}

export function toEmailLogDetailDTO(log: {
  id: string
  recipientEmail: string
  type: EmailLogType
  subject: string
  status: string
  organizationId: string | null
  relatedEntityType: string | null
  relatedEntityId: string | null
  ticketId: string | null
  ticketNumber: string | null
  providerMessageId: string | null
  errorMessage: string | null
  attempts: number
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
  bodyHtml: string | null
}): EmailLogDetailDTO {
  return {
    ...toEmailLogListItemDTO(log),
    previewUrl: log.bodyHtml ? `/api/email-logs/${log.id}/preview` : null,
  }
}
