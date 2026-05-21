import type {
  Prisma,
  SupportTicket as PrismaSupportTicket,
  SupportTicketDepartment as PrismaSupportTicketDepartment,
  SupportTicketReply as PrismaSupportTicketReply,
  SupportTicketStatus as PrismaSupportTicketStatus,
} from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { supportTicketAttachmentMetadataSchema } from "@/modules/support-tickets/support-ticket.schema"
import type {
  CreateSupportTicketInput,
  CreateSupportTicketReplyInput,
  SupportTicket,
  SupportTicketAttachmentMetadata,
  SupportTicketDepartment,
  SupportTicketStatus,
  SupportTicketThread,
} from "@/modules/support-tickets/support-ticket.types"

const DOMAIN_TO_PRISMA_STATUS: Record<
  SupportTicketStatus,
  PrismaSupportTicketStatus
> = {
  open: "OPEN",
  in_progress: "IN_PROGRESS",
  resolved: "RESOLVED",
  closed: "CLOSED",
}

const PRISMA_TO_DOMAIN_STATUS: Record<
  PrismaSupportTicketStatus,
  SupportTicketStatus
> = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
}

const DOMAIN_TO_PRISMA_DEPARTMENT: Record<
  SupportTicketDepartment,
  PrismaSupportTicketDepartment
> = {
  billing: "BILLING",
  technical: "TECHNICAL",
  account: "ACCOUNT",
  compliance: "COMPLIANCE",
}

const PRISMA_TO_DOMAIN_DEPARTMENT: Record<
  PrismaSupportTicketDepartment,
  SupportTicketDepartment
> = {
  BILLING: "billing",
  TECHNICAL: "technical",
  ACCOUNT: "account",
  COMPLIANCE: "compliance",
}

const normalizeAttachmentMetadata = (
  value: Prisma.JsonValue | null
): SupportTicketAttachmentMetadata[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => supportTicketAttachmentMetadataSchema.safeParse(item))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data)
}

const mapTicketRecord = (record: PrismaSupportTicket): SupportTicket => {
  return {
    id: record.id,
    ticketNumber: record.ticketNumber,
    organizationId: record.organizationId,
    requesterWorkosUserId: record.requesterWorkosUserId,
    assignedAgentWorkosUserId: record.assignedAgentWorkosUserId,
    department: PRISMA_TO_DOMAIN_DEPARTMENT[record.department],
    status: PRISMA_TO_DOMAIN_STATUS[record.status],
    subject: record.subject,
    description: record.description,
    attachmentMetadata: normalizeAttachmentMetadata(record.attachmentsJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    resolvedAt: record.resolvedAt,
    closedAt: record.closedAt,
  }
}

const mapReplyRecord = (
  record: PrismaSupportTicketReply
): SupportTicketThread["replies"][number] => {
  return {
    id: record.id,
    ticketId: record.ticketId,
    authorWorkosUserId: record.authorWorkosUserId,
    body: record.body,
    isInternalNote: record.isInternalNote,
    attachmentMetadata: normalizeAttachmentMetadata(record.attachmentsJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export type SupportTicketRepository = {
  createReply(
    input: CreateSupportTicketReplyInput
  ): Promise<SupportTicketThread["replies"][number]>
  createTicket(
    input: CreateSupportTicketInput & { ticketNumber: string }
  ): Promise<SupportTicket>
  getTicketById(ticketId: string): Promise<SupportTicket | null>
  getTicketThread(ticketId: string): Promise<SupportTicketThread | null>
  listTicketsByOrganization(input: {
    organizationId: string
    limit?: number
  }): Promise<SupportTicket[]>
  updateTicketStatus(input: {
    closedAt: Date | null
    resolvedAt: Date | null
    status: SupportTicketStatus
    ticketId: string
  }): Promise<SupportTicket>
}

export const supportTicketRepository: SupportTicketRepository = {
  async createTicket(input) {
    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber: input.ticketNumber,
        organizationId: input.organizationId,
        requesterWorkosUserId: input.requesterWorkosUserId,
        department: DOMAIN_TO_PRISMA_DEPARTMENT[input.department],
        status: "OPEN",
        subject: input.subject,
        description: input.description ?? null,
        attachmentsJson: (input.attachmentMetadata ?? []) as Prisma.JsonArray,
      },
    })

    return mapTicketRecord(ticket)
  },
  async getTicketById(ticketId) {
    const ticket = await prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },
    })

    if (!ticket) {
      return null
    }

    return mapTicketRecord(ticket)
  },
  async listTicketsByOrganization(input) {
    const rows = await prisma.supportTicket.findMany({
      where: {
        organizationId: input.organizationId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit ?? 50,
    })

    return rows.map(mapTicketRecord)
  },
  async getTicketThread(ticketId) {
    const ticket = await prisma.supportTicket.findUnique({
      where: {
        id: ticketId,
      },
      include: {
        replies: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })

    if (!ticket) {
      return null
    }

    return {
      ticket: mapTicketRecord(ticket),
      replies: ticket.replies.map(mapReplyRecord),
    }
  },
  async updateTicketStatus(input) {
    const ticket = await prisma.supportTicket.update({
      where: {
        id: input.ticketId,
      },
      data: {
        status: DOMAIN_TO_PRISMA_STATUS[input.status],
        resolvedAt: input.resolvedAt,
        closedAt: input.closedAt,
      },
    })

    return mapTicketRecord(ticket)
  },
  async createReply(input) {
    const reply = await prisma.supportTicketReply.create({
      data: {
        ticketId: input.ticketId,
        authorWorkosUserId: input.authorWorkosUserId,
        body: input.body,
        isInternalNote: input.isInternalNote ?? false,
        attachmentsJson: (input.attachmentMetadata ?? []) as Prisma.JsonArray,
      },
    })

    return mapReplyRecord(reply)
  },
}
