import type {
  Prisma,
  SupportTicket as PrismaSupportTicket,
  SupportTicketAttachmentUploadSession as PrismaSupportTicketAttachmentUploadSession,
  SupportTicketAttachmentUploadTarget as PrismaSupportTicketAttachmentUploadTarget,
  SupportTicketDepartment as PrismaSupportTicketDepartment,
  SupportTicketPriority as PrismaSupportTicketPriority,
  SupportTicketReply as PrismaSupportTicketReply,
  SupportTicketService as PrismaSupportTicketService,
  SupportTicketStatus as PrismaSupportTicketStatus,
} from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { supportTicketAttachmentMetadataSchema } from "@/modules/support-tickets/support-ticket.schema"
import type {
  CreateSupportTicketInput,
  CreateSupportTicketReplyInput,
  SupportTicket,
  SupportTicketAttachmentMetadata,
  SupportTicketAttachmentUploadSession,
  SupportTicketAttachmentUploadTarget,
  SupportTicketDepartment,
  SupportTicketPriority,
  SupportTicketService,
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

const DOMAIN_TO_PRISMA_PRIORITY: Record<
  SupportTicketPriority,
  PrismaSupportTicketPriority
> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
}

const PRISMA_TO_DOMAIN_PRIORITY: Record<
  PrismaSupportTicketPriority,
  SupportTicketPriority
> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
}

const DOMAIN_TO_PRISMA_SERVICE: Record<
  SupportTicketService,
  PrismaSupportTicketService
> = {
  auth: "AUTH",
  billing: "BILLING",
  deploy: "DEPLOY",
  domains: "DOMAINS",
  integrations: "INTEGRATIONS",
  data: "DATA",
  other: "OTHER",
}

const PRISMA_TO_DOMAIN_SERVICE: Record<
  PrismaSupportTicketService,
  SupportTicketService
> = {
  AUTH: "auth",
  BILLING: "billing",
  DEPLOY: "deploy",
  DOMAINS: "domains",
  INTEGRATIONS: "integrations",
  DATA: "data",
  OTHER: "other",
}

const DOMAIN_TO_PRISMA_UPLOAD_TARGET: Record<
  SupportTicketAttachmentUploadTarget,
  PrismaSupportTicketAttachmentUploadTarget
> = {
  create: "CREATE",
  reply: "REPLY",
}

const PRISMA_TO_DOMAIN_UPLOAD_TARGET: Record<
  PrismaSupportTicketAttachmentUploadTarget,
  SupportTicketAttachmentUploadTarget
> = {
  CREATE: "create",
  REPLY: "reply",
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

const appendUniqueAttachments = (
  current: SupportTicketAttachmentMetadata[],
  incoming: SupportTicketAttachmentMetadata[]
) => {
  const next = [...current]

  for (const item of incoming) {
    const exists = next.some((existing) => {
      return existing.id === item.id || existing.storageKey === item.storageKey
    })

    if (!exists) {
      next.push(item)
    }
  }

  return next
}

const mapUploadSessionToAttachment = (
  session: PrismaSupportTicketAttachmentUploadSession
): SupportTicketAttachmentMetadata => {
  return {
    id: session.id,
    fileName: session.fileName,
    mimeType: session.mimeType,
    sizeBytes: session.sizeBytes,
    storageKey: session.storageKey,
    checksumSha256: session.checksumSha256,
    uploadedAt: (session.registeredAt ?? session.createdAt).toISOString(),
  }
}

const mapTicketRecord = (record: PrismaSupportTicket): SupportTicket => {
  return {
    id: record.id,
    ticketNumber: record.ticketNumber,
    organizationId: record.organizationId,
    requesterWorkosUserId: record.requesterWorkosUserId,
    assignedAgentWorkosUserId: record.assignedAgentWorkosUserId,
    department: PRISMA_TO_DOMAIN_DEPARTMENT[record.department],
    priority: PRISMA_TO_DOMAIN_PRIORITY[record.priority],
    service: record.service ? PRISMA_TO_DOMAIN_SERVICE[record.service] : null,
    status: PRISMA_TO_DOMAIN_STATUS[record.status],
    subject: record.subject,
    description: record.description,
    secureForm: record.secureForm,
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
    secureForm: record.secureForm,
    isInternalNote: record.isInternalNote,
    attachmentMetadata: normalizeAttachmentMetadata(record.attachmentsJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

const mapUploadSessionRecord = (
  record: PrismaSupportTicketAttachmentUploadSession
): SupportTicketAttachmentUploadSession => {
  return {
    id: record.id,
    organizationId: record.organizationId,
    uploaderWorkosUserId: record.uploaderWorkosUserId,
    target: PRISMA_TO_DOMAIN_UPLOAD_TARGET[record.target],
    ticketId: record.ticketId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    checksumSha256: record.checksumSha256,
    storageKey: record.storageKey,
    storageBucket: record.storageBucket,
    expiresAt: record.expiresAt,
    registeredAt: record.registeredAt,
    consumedAt: record.consumedAt,
    consumedTicketId: record.consumedTicketId,
    consumedReplyId: record.consumedReplyId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

type ConsumeUploadSessionInput = {
  organizationId: string
  ticketId: string | null
  target: SupportTicketAttachmentUploadTarget
  uploadSessionIds: string[]
  uploaderWorkosUserId: string
}

const consumeUploadSessions = async (
  tx: Prisma.TransactionClient,
  input: ConsumeUploadSessionInput
) => {
  if (!input.uploadSessionIds.length) {
    return [] as SupportTicketAttachmentMetadata[]
  }

  const uniqueIds = [...new Set(input.uploadSessionIds)]
  const now = new Date()
  const sessions = await tx.supportTicketAttachmentUploadSession.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
      organizationId: input.organizationId,
      uploaderWorkosUserId: input.uploaderWorkosUserId,
      target: DOMAIN_TO_PRISMA_UPLOAD_TARGET[input.target],
      ticketId: input.ticketId,
      consumedAt: null,
      registeredAt: {
        not: null,
      },
      expiresAt: {
        gt: now,
      },
    },
  })

  if (sessions.length !== uniqueIds.length) {
    throw new Error(
      "One or more attachment upload sessions are missing, expired, or not registered."
    )
  }

  return sessions.map(mapUploadSessionToAttachment)
}

export type SupportTicketRepository = {
  createReply(
    input: CreateSupportTicketReplyInput
  ): Promise<SupportTicketThread["replies"][number]>
  createTicket(
    input: CreateSupportTicketInput & { ticketNumber: string }
  ): Promise<SupportTicket>
  createUploadSession(input: {
    checksumSha256?: string | null
    expiresAt: Date
    fileName: string
    id: string
    mimeType: string
    organizationId: string
    sizeBytes: number
    storageBucket: string
    storageKey: string
    target: SupportTicketAttachmentUploadTarget
    ticketId: string | null
    uploaderWorkosUserId: string
  }): Promise<SupportTicketAttachmentUploadSession>
  getTicketById(ticketId: string): Promise<SupportTicket | null>
  getTicketThread(ticketId: string): Promise<SupportTicketThread | null>
  getUploadSessionById(
    id: string
  ): Promise<SupportTicketAttachmentUploadSession | null>
  listTicketsByOrganization(input: {
    organizationId: string
    limit?: number
  }): Promise<SupportTicket[]>
  markUploadSessionRegistered(input: {
    checksumSha256?: string | null
    fileName: string
    id: string
    mimeType: string
    organizationId: string
    sizeBytes: number
    storageBucket: string
    storageKey: string
    target: SupportTicketAttachmentUploadTarget
    ticketId: string | null
    uploaderWorkosUserId: string
  }): Promise<SupportTicketAttachmentUploadSession>
  updateTicketStatus(input: {
    closedAt: Date | null
    resolvedAt: Date | null
    status: SupportTicketStatus
    ticketId: string
  }): Promise<SupportTicket>
}

export const supportTicketRepository: SupportTicketRepository = {
  async createUploadSession(input) {
    const record = await prisma.supportTicketAttachmentUploadSession.create({
      data: {
        id: input.id,
        organizationId: input.organizationId,
        uploaderWorkosUserId: input.uploaderWorkosUserId,
        target: DOMAIN_TO_PRISMA_UPLOAD_TARGET[input.target],
        ticketId: input.ticketId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256 ?? null,
        storageKey: input.storageKey,
        storageBucket: input.storageBucket,
        expiresAt: input.expiresAt,
      },
    })

    return mapUploadSessionRecord(record)
  },
  async getUploadSessionById(id) {
    const record = await prisma.supportTicketAttachmentUploadSession.findUnique({
      where: {
        id,
      },
    })

    if (!record) {
      return null
    }

    return mapUploadSessionRecord(record)
  },
  async markUploadSessionRegistered(input) {
    const existing = await prisma.supportTicketAttachmentUploadSession.findUnique({
      where: {
        id: input.id,
      },
    })

    if (!existing) {
      throw new Error("Attachment upload session was not found.")
    }

    const target = DOMAIN_TO_PRISMA_UPLOAD_TARGET[input.target]
    const hasMismatch =
      existing.organizationId !== input.organizationId ||
      existing.uploaderWorkosUserId !== input.uploaderWorkosUserId ||
      existing.target !== target ||
      existing.ticketId !== input.ticketId ||
      existing.storageKey !== input.storageKey ||
      existing.storageBucket !== input.storageBucket ||
      existing.fileName !== input.fileName ||
      existing.mimeType !== input.mimeType ||
      existing.sizeBytes !== input.sizeBytes ||
      (existing.checksumSha256 ?? null) !== (input.checksumSha256 ?? null)

    if (hasMismatch) {
      throw new Error("Attachment upload session payload mismatch.")
    }

    const record = await prisma.supportTicketAttachmentUploadSession.update({
      where: {
        id: input.id,
      },
      data: {
        registeredAt: new Date(),
      },
    })

    return mapUploadSessionRecord(record)
  },
  async createTicket(input) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          ticketNumber: input.ticketNumber,
          organizationId: input.organizationId,
          requesterWorkosUserId: input.requesterWorkosUserId,
          department: DOMAIN_TO_PRISMA_DEPARTMENT[input.department],
          priority: DOMAIN_TO_PRISMA_PRIORITY[input.priority],
          service: input.service ? DOMAIN_TO_PRISMA_SERVICE[input.service] : null,
          status: "OPEN",
          subject: input.subject,
          description: input.description ?? null,
          secureForm: input.secureForm ?? null,
          attachmentsJson: (input.attachmentMetadata ?? []) as Prisma.JsonArray,
        },
      })

      const uploadAttachments = await consumeUploadSessions(tx, {
        organizationId: input.organizationId,
        uploaderWorkosUserId: input.requesterWorkosUserId,
        target: "create",
        ticketId: null,
        uploadSessionIds: input.uploadSessionIds ?? [],
      })

      const mergedAttachments = appendUniqueAttachments(
        normalizeAttachmentMetadata(created.attachmentsJson),
        uploadAttachments
      )

      if (uploadAttachments.length > 0) {
        await tx.supportTicketAttachmentUploadSession.updateMany({
          where: {
            id: {
              in: uploadAttachments.map((attachment) => attachment.id),
            },
          },
          data: {
            consumedAt: new Date(),
            consumedTicketId: created.id,
          },
        })
      }

      const updatedTicket =
        uploadAttachments.length > 0 || (input.attachmentMetadata ?? []).length > 0
          ? await tx.supportTicket.update({
              where: {
                id: created.id,
              },
              data: {
                attachmentsJson: mergedAttachments as Prisma.JsonArray,
              },
            })
          : created

      return mapTicketRecord(updatedTicket)
    })
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
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: {
          id: input.ticketId,
        },
        select: {
          organizationId: true,
        },
      })

      if (!ticket) {
        throw new Error(`Support ticket ${input.ticketId} was not found.`)
      }

      const created = await tx.supportTicketReply.create({
        data: {
          ticketId: input.ticketId,
          authorWorkosUserId: input.authorWorkosUserId,
          body: input.body,
          secureForm: input.secureForm ?? null,
          isInternalNote: input.isInternalNote ?? false,
          attachmentsJson: (input.attachmentMetadata ?? []) as Prisma.JsonArray,
        },
      })

      const uploadAttachments = await consumeUploadSessions(tx, {
        organizationId: ticket.organizationId,
        uploaderWorkosUserId: input.authorWorkosUserId,
        target: "reply",
        ticketId: input.ticketId,
        uploadSessionIds: input.uploadSessionIds ?? [],
      })

      const mergedAttachments = appendUniqueAttachments(
        normalizeAttachmentMetadata(created.attachmentsJson),
        uploadAttachments
      )

      if (uploadAttachments.length > 0) {
        await tx.supportTicketAttachmentUploadSession.updateMany({
          where: {
            id: {
              in: uploadAttachments.map((attachment) => attachment.id),
            },
          },
          data: {
            consumedAt: new Date(),
            consumedReplyId: created.id,
          },
        })
      }

      const updatedReply =
        uploadAttachments.length > 0 || (input.attachmentMetadata ?? []).length > 0
          ? await tx.supportTicketReply.update({
              where: {
                id: created.id,
              },
              data: {
                attachmentsJson: mergedAttachments as Prisma.JsonArray,
              },
            })
          : created

      return mapReplyRecord(updatedReply)
    })
  },
}
