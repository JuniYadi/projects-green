import { z } from "zod"

import {
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_STATUSES,
} from "@/modules/support-tickets/support-ticket.types"

export const supportTicketDepartmentSchema = z.enum(SUPPORT_TICKET_DEPARTMENTS)

export const supportTicketStatusSchema = z.enum(SUPPORT_TICKET_STATUSES)

export const supportTicketAttachmentMetadataSchema = z.object({
  checksumSha256: z.string().trim().min(1).nullable().optional(),
  fileName: z.string().trim().min(1, "Attachment file name is required."),
  id: z.string().trim().min(1, "Attachment id is required."),
  mimeType: z.string().trim().min(1, "Attachment MIME type is required."),
  sizeBytes: z
    .number()
    .int("Attachment size must be an integer.")
    .nonnegative("Attachment size must be greater than or equal to 0."),
  storageKey: z.string().trim().min(1, "Attachment storage key is required."),
  uploadedAt: z.string().trim().min(1, "Attachment uploadedAt is required."),
})

export const createSupportTicketInputSchema = z.object({
  attachmentMetadata: z
    .array(supportTicketAttachmentMetadataSchema)
    .default([])
    .optional(),
  department: supportTicketDepartmentSchema,
  description: z.string().trim().min(1).nullable().optional(),
  organizationId: z.string().trim().min(1, "organizationId is required."),
  requesterWorkosUserId: z
    .string()
    .trim()
    .min(1, "requesterWorkosUserId is required."),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters."),
})

export const createSupportTicketReplyInputSchema = z.object({
  attachmentMetadata: z
    .array(supportTicketAttachmentMetadataSchema)
    .default([])
    .optional(),
  authorWorkosUserId: z
    .string()
    .trim()
    .min(1, "authorWorkosUserId is required."),
  body: z.string().trim().min(1, "Reply body is required."),
  isInternalNote: z.boolean().default(false).optional(),
  ticketId: z.string().trim().min(1, "ticketId is required."),
})

export const supportTicketActorContextSchema = z.object({
  canManageTickets: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  organizationId: z.string().trim().min(1, "organizationId is required."),
  workosUserId: z.string().trim().min(1, "workosUserId is required."),
})
